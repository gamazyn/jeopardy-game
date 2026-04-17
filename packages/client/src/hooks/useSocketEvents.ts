import { useEffect } from 'react';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';

export function useSocketEvents() {
  const store = useGameStore();
  const { setMyId, setBuzzerPosition } = usePlayerStore();

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      setMyId(socket.id ?? '');
    });

    socket.on('player:joined', ({ allPlayers }) => {
      store.setPlayers(allPlayers);
    });

    socket.on('player:left', ({ allPlayers }) => {
      store.setPlayers(allPlayers);
    });

    socket.on('game:started', ({ gameConfig, players }) => {
      store.setGameStarted(gameConfig, players);
    });

    socket.on('question:selected', ({ activeQuestion, phase }) => {
      store.setActiveQuestion(activeQuestion);
      store.setPhase(phase);
      setBuzzerPosition(null);
      // Limpar estado de tipos especiais ao selecionar nova questão
      store.setDoubleAssigned(null, null);
      store.setChallengeState(null);
    });

    socket.on('question:answerReveal', ({ phase }) => {
      store.setPhase(phase);
      store.setBuzzerQueue([]);
      setBuzzerPosition(null);
    });

    socket.on('question:closed', ({ categoryId, questionId, phase }) => {
      store.markQuestionUsed(categoryId, questionId);
      store.setActiveQuestion(null);
      store.setPhase(phase);
      store.setBuzzerQueue([]);
      setBuzzerPosition(null);
    });

    socket.on('buzzer:opened', () => {});

    socket.on('buzzer:confirmed', ({ position }) => {
      setBuzzerPosition(position);
    });

    socket.on('buzzer:queueUpdate', ({ queue, phase }) => {
      store.setBuzzerQueue(queue);
      store.setPhase(phase);
    });

    socket.on('judge:result', ({ phase }) => {
      store.setPhase(phase);
    });

    socket.on('score:update', ({ players }) => {
      store.setPlayers(players);
    });

    socket.on('timer:update', ({ action, remainingMs, totalMs }) => {
      store.setTimer({
        remainingMs,
        totalMs,
        isPaused: action === 'pause',
      });
      if (action === 'expired') store.setTimer(null);
    });

    socket.on('final:started', ({ clue, media }) => {
      store.setFinalChallenge(clue, media);
    });

    // Somente o host recebe este evento (server emite para host:sessionId)
    socket.on('final:hostDetails', ({ correctAnswer }) => {
      store.setFinalCorrectAnswer(correctAnswer);
    });

    // Quando alguém aposta — todos recebem (sem valores)
    socket.on('final:wagerConfirmed', ({ playerId, playerName, totalSubmitted, totalPlayers }) => {
      store.addWagerSubmitted(playerId, playerName);
      // Se todos apostaram, transitar para fase de revelação
      if (totalSubmitted >= totalPlayers && totalPlayers > 0) {
        store.setPhase('final_reveal');
      }
    });

    // Somente o host recebe os detalhes da aposta
    socket.on('final:hostWagerReceived', (wager) => {
      store.addHostWager(wager);
    });

    socket.on('final:revealed', ({ playerId, newScore }) => {
      store.setPlayers(
        useGameStore.getState().players.map((p) =>
          p.id === playerId ? { ...p, score: newScore } : p,
        ),
      );
      store.markWagerRevealed(playerId);
    });

    socket.on('game:over', ({ finalScores }) => {
      store.setPlayers(finalScores);
      store.setPhase('game_over');
    });

    socket.on('double:started', ({ assignedPlayerId, assignedPlayerName }) => {
      store.setDoubleAssigned(assignedPlayerId, assignedPlayerName);
      // Garantir fase double_wager caso o evento chegue após question:selected
      if (assignedPlayerId) {
        // Fase já foi setada via question:selected — só atualiza o player atribuído
      }
    });

    socket.on('double:wagerLocked', ({ amount }) => {
      store.setDoubleWagerLocked(amount);
    });

    socket.on('challenge:assigned', ({ challengeState }) => {
      store.setChallengeState(challengeState);
    });

    socket.on('error', ({ code, message }) => {
      console.error(`[socket error] ${code}: ${message}`);
    });

    return () => {
      socket.off('connect');
      socket.off('player:joined');
      socket.off('player:left');
      socket.off('game:started');
      socket.off('question:selected');
      socket.off('question:answerReveal');
      socket.off('question:closed');
      socket.off('buzzer:opened');
      socket.off('buzzer:confirmed');
      socket.off('buzzer:queueUpdate');
      socket.off('judge:result');
      socket.off('score:update');
      socket.off('timer:update');
      socket.off('final:started');
      socket.off('final:hostDetails');
      socket.off('final:wagerConfirmed');
      socket.off('final:hostWagerReceived');
      socket.off('final:revealed');
      socket.off('game:over');
      socket.off('double:started');
      socket.off('double:wagerLocked');
      socket.off('challenge:assigned');
      socket.off('error');
      // Não desconecta — conexão persiste durante toda a sessão de jogo
    };
  }, []);
}
