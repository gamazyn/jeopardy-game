import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, GameConfig } from '@jeopardy/shared';
import { getSession, updateSession } from '../managers/sessionManager.js';
import { validateHostToken } from '../middleware/authMiddleware.js';
import { canTransition, allQuestionsUsed } from '../managers/gameStateManager.js';
import { emitFinalChallengeStart } from './finalHandler.js';
import { startTimer, stopTimer, pauseTimer, resumeTimer, extendTimer, setTimer } from '../managers/timerManager.js';
import { DEFAULT_TIMER_MS } from '../config.js';

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

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  // HOST: iniciar jogo
  socket.on('host:start', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (!canTransition(session.phase, 'board')) {
      socket.emit('error', { code: 'INVALID_TRANSITION', message: 'Não é possível iniciar agora.' });
      return;
    }

    if (Object.keys(session.players).length === 0) {
      socket.emit('error', { code: 'NO_PLAYERS', message: 'Precisa de ao menos 1 jogador.' });
      return;
    }

    const { finalChallengeAnswer: _omit, ...safeConfig } = session.gameConfig;

    updateSession(payload.sessionId, { phase: 'board', startedAt: Date.now() });

    io.to(`session:${payload.sessionId}`).emit('game:started', {
      gameConfig: safeConfig as Omit<GameConfig, 'finalChallengeAnswer'>,
      players: Object.values(session.players),
    });
  });

  // HOST: selecionar questão
  socket.on('host:selectQuestion', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (!canTransition(session.phase, 'question')) {
      socket.emit('error', { code: 'INVALID_TRANSITION', message: 'Não é possível selecionar questão agora.' });
      return;
    }

    const category = session.gameConfig.categories.find((c) => c.id === payload.categoryId);
    const question = category?.questions.find((q) => q.id === payload.questionId);

    if (!category || !question) {
      socket.emit('error', { code: 'QUESTION_NOT_FOUND', message: 'Questão não encontrada.' });
      return;
    }

    if (question.used) {
      socket.emit('error', { code: 'QUESTION_USED', message: 'Questão já foi utilizada.' });
      return;
    }

    const timerMs = (question.timeOverride ?? session.gameConfig.defaultTimer) * 1000;
    const activeQuestion = {
      categoryId: payload.categoryId,
      questionId: payload.questionId,
      question,
      startedAt: Date.now(),
      timerDuration: timerMs,
    };

    updateSession(payload.sessionId, {
      phase: 'question',
      activeQuestion,
      buzzerQueue: [],
    });

    io.to(`session:${payload.sessionId}`).emit('question:selected', {
      activeQuestion,
      phase: 'question',
    });

    startTimer(io, payload.sessionId, timerMs, () => {
      const current = getSession(payload.sessionId);
      if (current?.phase === 'question') {
        closeQuestion(io, payload.sessionId, false);
      }
    });
  });

  // HOST: limpar questão sem pontuar
  socket.on('host:clearQuestion', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;
    closeQuestion(io, payload.sessionId, false);
  });

  // HOST: controle do timer
  socket.on('host:timerControl', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    const onExpire = () => {
      const current = getSession(payload.sessionId);
      if (current?.phase === 'question') closeQuestion(io, payload.sessionId, false);
    };

    switch (payload.action) {
      case 'pause':
        pauseTimer(io, payload.sessionId);
        break;
      case 'resume':
        resumeTimer(io, payload.sessionId, onExpire);
        break;
      case 'extend':
        extendTimer(io, payload.sessionId, (payload.seconds ?? 30) * 1000, onExpire);
        break;
      case 'set':
        setTimer(io, payload.sessionId, (payload.seconds ?? 60) * 1000, onExpire);
        break;
    }
  });

  // HOST: ajustar score manualmente
  socket.on('host:adjustScore', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    const player = session.players[payload.playerId];
    if (!player) return;

    const updated = { ...session.players };
    updated[payload.playerId] = { ...player, score: player.score + payload.delta };
    updateSession(payload.sessionId, { players: updated });

    io.to(`session:${payload.sessionId}`).emit('score:update', {
      players: Object.values(updated),
    });
  });

  // HOST: encerrar jogo
  socket.on('host:endGame', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    stopTimer(payload.sessionId);
    updateSession(payload.sessionId, { phase: 'game_over', endedAt: Date.now() });

    const players = Object.values(session.players).sort((a, b) => b.score - a.score);
    io.to(`session:${payload.sessionId}`).emit('game:over', {
      finalScores: players,
      winnerId: players[0]?.id ?? '',
    });
  });
}

export function closeQuestion(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  sessionId: string,
  markUsed: boolean,
): void {
  stopTimer(sessionId);
  const session = getSession(sessionId);
  if (!session?.activeQuestion) return;

  const { categoryId, questionId } = session.activeQuestion;

  // Marcar questão como usada se solicitado
  const updatedCategories = session.gameConfig.categories.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      questions: cat.questions.map((q) =>
        q.id === questionId ? { ...q, used: markUsed || q.used } : q,
      ),
    };
  });

  const updatedConfig = { ...session.gameConfig, categories: updatedCategories };

  // Verificar se todas as questões foram usadas → Desafio Final
  const allUsed = allQuestionsUsed(updatedCategories);
  const nextPhase = allUsed && updatedConfig.finalChallengeEnabled ? 'final_challenge' : 'board';

  updateSession(sessionId, {
    phase: nextPhase,
    activeQuestion: null,
    buzzerQueue: [],
    gameConfig: updatedConfig,
  });

  io.to(`session:${sessionId}`).emit('question:closed', {
    questionId,
    categoryId,
    phase: nextPhase,
  });

  if (nextPhase === 'final_challenge') {
    emitFinalChallengeStart(io, sessionId);
  }
}
