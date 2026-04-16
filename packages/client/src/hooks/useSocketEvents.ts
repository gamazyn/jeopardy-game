import { useEffect } from 'react';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';

export function useSocketEvents() {
  const store = useGameStore();
  const { setMyId, setBuzzerPosition } = usePlayerStore();

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setMyId(socket.id ?? '');
    });

    socket.on('player:joined', ({ player, allPlayers }) => {
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
    });

    socket.on('question:closed', ({ categoryId, questionId, phase }) => {
      store.markQuestionUsed(categoryId, questionId);
      store.setActiveQuestion(null);
      store.setPhase(phase);
      store.setBuzzerQueue([]);
      setBuzzerPosition(null);
    });

    socket.on('buzzer:opened', () => {
      // Abrir buzzer para interação
    });

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
      if (action === 'expired') {
        store.setTimer(null);
      }
    });

    socket.on('final:started', ({ clue, media }) => {
      store.setFinalChallenge(clue, media);
    });

    socket.on('final:revealed', ({ playerId, newScore }) => {
      store.setPlayers(
        useGameStore.getState().players.map((p) =>
          p.id === playerId ? { ...p, score: newScore } : p,
        ),
      );
    });

    socket.on('game:over', ({ finalScores }) => {
      store.setPlayers(finalScores);
      store.setPhase('game_over');
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
      socket.off('question:closed');
      socket.off('buzzer:opened');
      socket.off('buzzer:confirmed');
      socket.off('buzzer:queueUpdate');
      socket.off('judge:result');
      socket.off('score:update');
      socket.off('timer:update');
      socket.off('final:started');
      socket.off('final:revealed');
      socket.off('game:over');
      socket.off('error');
      socket.disconnect();
    };
  }, []);
}
