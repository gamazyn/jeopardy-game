import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, BuzzerEntry } from '@responde-ai/shared';
import { getSession, updateSession } from '../managers/sessionManager.js';
import { validateHostToken } from '../middleware/authMiddleware.js';
import { socketRateLimit } from '../middleware/rateLimiter.js';
import { closeQuestion } from './gameHandler.js';
import { startTimer } from '../managers/timerManager.js';

function requireHost(
  socket: Socket,
  sessionId: string,
  hostToken: string,
): ReturnType<typeof getSession> | null {
  const session = getSession(sessionId);
  if (!session) {
    socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada.' });
    return null;
  }
  if (session.hostId !== socket.id || !validateHostToken(session.hostToken, hostToken)) {
    socket.emit('error', { code: 'NOT_HOST', message: 'Ação não permitida.' });
    return null;
  }
  return session;
}

export function registerBuzzerHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  // PLAYER: apertar buzzer
  socket.on('player:buzz', (payload) => {
    if (!socketRateLimit(socket.id, 'player:buzz', 3)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Muitas tentativas.' });
      return;
    }

    const serverTimestamp = Date.now(); // Sempre timestamp do servidor

    const session = getSession(payload.sessionId);
    if (!session) return;

    // Aceita buzz em question, all_play e buzzer_queue (para montar a fila completa)
    if (session.phase !== 'question' && session.phase !== 'all_play' && session.phase !== 'buzzer_queue') return;

    const player = session.players[socket.id];
    if (!player) return;

    // Dupla Aposta: só o jogador atribuído pode buzzar
    if (session.activeQuestion?.question.type === 'double' && session.doublePlayerId && socket.id !== session.doublePlayerId) return;

    // Evitar duplicata na fila
    if (session.buzzerQueue.some((e) => e.playerId === socket.id)) return;

    const entry: BuzzerEntry = {
      playerId: socket.id,
      playerName: player.name,
      timestamp: serverTimestamp,
      responded: false,
    };

    const updatedQueue = [...session.buzzerQueue, entry].sort((a, b) => a.timestamp - b.timestamp);

    updateSession(payload.sessionId, {
      phase: 'buzzer_queue',
      buzzerQueue: updatedQueue,
    });

    // Confirmar posição para o player que buzzou
    const position = updatedQueue.findIndex((e) => e.playerId === socket.id) + 1;
    socket.emit('buzzer:confirmed', { position });

    // Enviar fila completa apenas ao host
    io.to(`host:${payload.sessionId}`).emit('buzzer:queueUpdate', {
      queue: updatedQueue,
      phase: 'buzzer_queue',
    });
  });

  // HOST: julgar resposta (standard, all_play, double, challenge)
  socket.on('host:judge', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (session.phase !== 'buzzer_queue') return;

    const activeQuestion = session.activeQuestion;
    if (!activeQuestion) return;

    const isChallenge = activeQuestion.question.type === 'challenge' &&
      session.challengeState?.challengedId === payload.playerId;

    // Para challenge, o jogador desafiado pode não estar na fila — bypass da verificação
    if (!isChallenge) {
      const playerEntry = session.buzzerQueue.find(
        (e) => e.playerId === payload.playerId && !e.responded,
      );
      if (!playerEntry) return;
    }

    const player = session.players[payload.playerId];
    if (!player) return;

    const updatedPlayers = { ...session.players };

    let scoreChange: number;
    let newScore: number;

    if (isChallenge && session.challengeState) {
      // Scoring especial de challenge
      const challenger = session.players[session.challengeState.challengerId];
      const value = activeQuestion.question.value;
      if (payload.correct) {
        // Desafiado acerta: +value; desafiador perde metade
        scoreChange = value;
        updatedPlayers[payload.playerId] = { ...player, score: player.score + value };
        if (challenger) {
          const challengerLoss = Math.floor(value / 2);
          updatedPlayers[session.challengeState.challengerId] = {
            ...challenger,
            score: challenger.score - challengerLoss,
          };
        }
      } else {
        // Desafiado erra: -value; desafiador ganha metade
        scoreChange = -value;
        updatedPlayers[payload.playerId] = { ...player, score: player.score - value };
        if (challenger) {
          const challengerGain = Math.floor(value / 2);
          updatedPlayers[session.challengeState.challengerId] = {
            ...challenger,
            score: challenger.score + challengerGain,
          };
        }
      }
      newScore = updatedPlayers[payload.playerId].score;
    } else if (activeQuestion.question.type === 'double' && session.doubleWager !== null) {
      // Scoring de Dupla Aposta: usa o valor apostado
      scoreChange = payload.correct ? session.doubleWager : -session.doubleWager;
      newScore = player.score + scoreChange;
      updatedPlayers[payload.playerId] = { ...player, score: newScore };
    } else {
      // Scoring padrão
      scoreChange = payload.correct ? activeQuestion.question.value : -activeQuestion.question.value;
      newScore = player.score + scoreChange;
      updatedPlayers[payload.playerId] = { ...player, score: newScore };
    }

    // Marcar como respondido na fila (se estiver)
    const updatedQueue = session.buzzerQueue.map((e) =>
      e.playerId === payload.playerId ? { ...e, responded: true } : e,
    );

    const nextInQueue = isChallenge ? null : (updatedQueue.find((e) => !e.responded) ?? null);
    const newPhase = payload.correct ? 'answer_reveal' : (nextInQueue ? 'buzzer_queue' : 'board');

    updateSession(payload.sessionId, {
      phase: newPhase,
      players: updatedPlayers,
      buzzerQueue: updatedQueue,
    });

    io.to(`session:${payload.sessionId}`).emit('judge:result', {
      playerId: payload.playerId,
      correct: payload.correct,
      scoreChange,
      newScore,
      nextInQueue,
      phase: newPhase,
    });

    io.to(`session:${payload.sessionId}`).emit('score:update', {
      players: Object.values(updatedPlayers),
    });

    if (payload.correct) {
      closeQuestion(io, payload.sessionId, true);
    } else if (!nextInQueue) {
      closeQuestion(io, payload.sessionId, true);
    } else {
      io.to(`host:${payload.sessionId}`).emit('buzzer:queueUpdate', {
        queue: updatedQueue,
        phase: 'buzzer_queue',
      });
    }
  });

  // HOST: definir jogador desafiado (questão challenge)
  socket.on('host:setChallenge', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session || session.phase !== 'buzzer_queue') return;

    const activeQuestion = session.activeQuestion;
    if (!activeQuestion || activeQuestion.question.type !== 'challenge') return;

    const challenged = session.players[payload.challengedId];
    if (!challenged) {
      socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: 'Jogador não encontrado.' });
      return;
    }

    // Challenger é o primeiro da fila que ainda não respondeu
    const challenger = session.buzzerQueue.find((e) => !e.responded);
    if (!challenger) return;

    const challengeState = {
      challengerId: challenger.playerId,
      challengerName: challenger.playerName,
      challengedId: payload.challengedId,
      challengedName: challenged.name,
    };

    updateSession(payload.sessionId, { challengeState });

    io.to(`session:${payload.sessionId}`).emit('challenge:assigned', { challengeState });
  });

  // PLAYER: enviar aposta da Dupla Aposta
  socket.on('player:doubleWager', (payload) => {
    const session = getSession(payload.sessionId);
    if (!session || session.phase !== 'double_wager') return;

    // Só o jogador atribuído pode apostar
    if (session.doublePlayerId !== socket.id) return;
    // Só uma aposta
    if (session.doubleWager !== null) return;

    const player = session.players[socket.id];
    if (!player) return;

    const activeQuestion = session.activeQuestion;
    if (!activeQuestion) return;

    // Saldo negativo: pode apostar até o valor da questão (chance de recuperar)
    // Saldo positivo: pode apostar até o saldo atual
    const maxWager = Math.max(player.score, activeQuestion.question.value);
    const amount = Math.max(0, Math.min(payload.amount, maxWager));

    // Salva aposta e transita para question (clue revela para todos, timer inicia)
    updateSession(payload.sessionId, {
      phase: 'question',
      doubleWager: amount,
    });

    // Avisa todos que a aposta foi feita e o clue vai ser revelado
    io.to(`session:${payload.sessionId}`).emit('double:wagerLocked', {
      assignedPlayerId: socket.id,
      amount,
    });

    // Re-emite question:selected para revelar o clue (com phase=question)
    io.to(`session:${payload.sessionId}`).emit('question:selected', {
      activeQuestion,
      phase: 'question',
    });

    // Inicia o timer
    const timerMs = activeQuestion.timerDuration;
    startTimer(io, payload.sessionId, timerMs, () => {
      const current = getSession(payload.sessionId);
      if (current?.phase === 'question') {
        closeQuestion(io, payload.sessionId, false);
      }
    });
  });

  // HOST: pular player da fila
  socket.on('host:skipPlayer', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    const updatedQueue = session.buzzerQueue.map((e) =>
      e.playerId === payload.playerId ? { ...e, responded: true } : e,
    );

    const nextInQueue = updatedQueue.find((e) => !e.responded) ?? null;
    const newPhase = nextInQueue ? 'buzzer_queue' : 'board';

    updateSession(payload.sessionId, {
      phase: newPhase as 'buzzer_queue' | 'board',
      buzzerQueue: updatedQueue,
    });

    io.to(`host:${payload.sessionId}`).emit('buzzer:queueUpdate', {
      queue: updatedQueue,
      phase: newPhase as 'buzzer_queue' | 'board',
    });

    if (!nextInQueue) {
      closeQuestion(io, payload.sessionId, true);
    }
  });
}
