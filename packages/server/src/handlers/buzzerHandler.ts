import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, BuzzerEntry } from '@jeopardy/shared';
import { getSession, updateSession } from '../managers/sessionManager.js';
import { validateHostToken } from '../middleware/authMiddleware.js';
import { socketRateLimit } from '../middleware/rateLimiter.js';
import { closeQuestion } from './gameHandler.js';

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

    if (session.phase !== 'question' && session.phase !== 'all_play') return;

    const player = session.players[socket.id];
    if (!player) return;

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

  // HOST: julgar resposta
  socket.on('host:judge', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (session.phase !== 'buzzer_queue') return;

    const activeQuestion = session.activeQuestion;
    if (!activeQuestion) return;

    const playerEntry = session.buzzerQueue.find(
      (e) => e.playerId === payload.playerId && !e.responded,
    );
    if (!playerEntry) return;

    const player = session.players[payload.playerId];
    if (!player) return;

    const scoreChange = payload.correct ? activeQuestion.question.value : -activeQuestion.question.value;
    const newScore = player.score + scoreChange;

    // Atualizar score
    const updatedPlayers = { ...session.players };
    updatedPlayers[payload.playerId] = { ...player, score: newScore };

    // Marcar como respondido
    const updatedQueue = session.buzzerQueue.map((e) =>
      e.playerId === payload.playerId ? { ...e, responded: true } : e,
    );

    const nextInQueue = updatedQueue.find((e) => !e.responded) ?? null;
    const newPhase = nextInQueue ? 'buzzer_queue' : 'board';

    updateSession(payload.sessionId, {
      phase: newPhase as 'buzzer_queue' | 'board',
      players: updatedPlayers,
      buzzerQueue: updatedQueue,
    });

    // Broadcast resultado do julgamento
    io.to(`session:${payload.sessionId}`).emit('judge:result', {
      playerId: payload.playerId,
      correct: payload.correct,
      scoreChange,
      newScore,
      nextInQueue,
      phase: newPhase as 'buzzer_queue' | 'board',
    });

    // Broadcast scores atualizados
    io.to(`session:${payload.sessionId}`).emit('score:update', {
      players: Object.values(updatedPlayers),
    });

    // Se correto, fechar questão marcando como usada
    if (payload.correct) {
      closeQuestion(io, payload.sessionId, true);
    } else if (!nextInQueue) {
      // Fila esgotada e ninguém acertou
      closeQuestion(io, payload.sessionId, true);
    } else {
      // Atualizar fila para o host
      io.to(`host:${payload.sessionId}`).emit('buzzer:queueUpdate', {
        queue: updatedQueue,
        phase: 'buzzer_queue',
      });
    }
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
