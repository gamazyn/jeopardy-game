import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@responde-ai/shared';
import { sanitizeAnswer } from '@responde-ai/shared';
import { getSession, updateSession } from '../managers/sessionManager.js';
import { validateHostToken } from '../middleware/authMiddleware.js';
import { canTransition } from '../managers/gameStateManager.js';

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

/** Emite os eventos de início do Desafio Final para todos + detalhes ao host */
export function emitFinalChallengeStart(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  sessionId: string,
): void {
  const session = getSession(sessionId);
  if (!session) return;

  io.to(`session:${sessionId}`).emit('final:started', {
    clue: session.gameConfig.finalChallengeClue,
    media: session.gameConfig.finalChallengeMedia,
    wagerDeadlineMs: 60_000,
  });

  // Envia a resposta correta apenas ao host
  io.to(`host:${sessionId}`).emit('final:hostDetails', {
    correctAnswer: session.gameConfig.finalChallengeAnswer,
  });
}

export function registerFinalHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  // HOST: iniciar Desafio Final manualmente (quando botão clicado antes de todas as questões)
  socket.on('host:startFinal', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (!canTransition(session.phase, 'final_challenge')) {
      socket.emit('error', { code: 'INVALID_TRANSITION', message: 'Não é possível iniciar o Desafio Final agora.' });
      return;
    }

    updateSession(payload.sessionId, { phase: 'final_challenge' });
    emitFinalChallengeStart(io, payload.sessionId);
  });

  // PLAYER: enviar aposta do Desafio Final
  socket.on('player:finalWager', (payload) => {
    const session = getSession(payload.sessionId);
    if (!session || session.phase !== 'final_challenge') return;

    const player = session.players[socket.id];
    if (!player) return;

    // Não permitir re-envio
    if (session.finalChallengeWagers[socket.id]) return;

    const amount = Math.max(0, Math.min(payload.amount, Math.max(player.score, 0)));
    const answer = sanitizeAnswer(payload.answer);

    const updatedWagers = {
      ...session.finalChallengeWagers,
      [socket.id]: { playerId: socket.id, amount, answer, revealed: false },
    };

    updateSession(payload.sessionId, { finalChallengeWagers: updatedWagers });

    const totalPlayers = Object.keys(session.players).length;
    const totalSubmitted = Object.keys(updatedWagers).length;

    // Confirma para TODOS (sem valores) — host e players sabem quem enviou
    io.to(`session:${payload.sessionId}`).emit('final:wagerConfirmed', {
      playerId: socket.id,
      playerName: player.name,
      totalSubmitted,
      totalPlayers,
    });

    // Envia detalhes da aposta APENAS ao host
    io.to(`host:${payload.sessionId}`).emit('final:hostWagerReceived', {
      playerId: socket.id,
      playerName: player.name,
      amount,
      answer,
    });

    // Se todos apostaram, mover para fase de revelação
    if (totalSubmitted >= totalPlayers) {
      updateSession(payload.sessionId, { phase: 'final_reveal' });
    }
  });

  // HOST: revelar aposta de um player
  socket.on('host:revealFinal', (payload) => {
    const session = requireHost(socket, payload.sessionId, payload.hostToken);
    if (!session) return;

    if (session.phase !== 'final_reveal' && session.phase !== 'final_challenge') return;

    const wager = session.finalChallengeWagers[payload.playerId];
    if (!wager || wager.revealed) return;

    const player = session.players[payload.playerId];
    if (!player) return;

    const scoreChange = payload.isCorrect ? wager.amount : -wager.amount;
    const oldScore = player.score;
    const newScore = oldScore + scoreChange;

    const updatedPlayers = { ...session.players };
    updatedPlayers[payload.playerId] = { ...player, score: newScore };

    const updatedWagers = { ...session.finalChallengeWagers };
    updatedWagers[payload.playerId] = { ...wager, isCorrect: payload.isCorrect, revealed: true };

    updateSession(payload.sessionId, {
      phase: 'final_reveal',
      players: updatedPlayers,
      finalChallengeWagers: updatedWagers,
    });

    io.to(`session:${payload.sessionId}`).emit('final:revealed', {
      playerId: payload.playerId,
      playerName: player.name,
      wager: wager.amount,
      answer: wager.answer,
      isCorrect: payload.isCorrect,
      oldScore,
      newScore,
    });

    io.to(`session:${payload.sessionId}`).emit('score:update', {
      players: Object.values(updatedPlayers),
    });

    const allRevealed = Object.values(updatedWagers).every((w) => w.revealed);
    if (allRevealed) {
      const players = Object.values(updatedPlayers).sort((a, b) => b.score - a.score);
      updateSession(payload.sessionId, { phase: 'game_over', endedAt: Date.now() });
      io.to(`session:${payload.sessionId}`).emit('game:over', {
        finalScores: players,
        winnerId: players[0]?.id ?? '',
      });
    }
  });
}
