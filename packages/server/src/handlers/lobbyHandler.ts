import type { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import type { ServerToClientEvents, ClientToServerEvents } from '@responde-ai/shared';
import { sanitizePlayerName, generateJoinCode, isValidJoinCode } from '@responde-ai/shared';
import { generateHostToken } from '../middleware/authMiddleware.js';
import { createSession, getSession, updateSession, getSessionByPlayerId } from '../managers/sessionManager.js';
import { loadGame } from '../storage/fileStorage.js';
import { socketRateLimit } from '../middleware/rateLimiter.js';
import { MAX_PLAYERS } from '../config.js';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F59E0B',
];

let tunnelUrl: string | null = null;
let localUrl: string | null = null;

export function setTunnelUrl(url: string | null): void {
  tunnelUrl = url;
}

export function setLocalUrl(url: string | null): void {
  localUrl = url;
}

export function registerLobbyHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  // HOST: criar sessão
  socket.on('host:create', async (payload, ack) => {
    if (!socketRateLimit(socket.id, 'host:create', 2)) {
      ack({ code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde.' });
      return;
    }

    const game = await loadGame(payload.gameConfigId);
    if (!game) {
      ack({ code: 'GAME_NOT_FOUND', message: 'Jogo não encontrado.' });
      return;
    }

    const sessionId = generateJoinCode();
    const hostToken = generateHostToken(sessionId);

    // Resetar questões usadas ao iniciar sessão
    const freshConfig = {
      ...game,
      categories: game.categories.map((cat) => ({
        ...cat,
        questions: cat.questions.map((q) => ({ ...q, used: false })),
      })),
    };

    createSession({
      sessionId,
      hostId: socket.id,
      hostToken,
      gameConfig: freshConfig,
      players: {},
      phase: 'lobby',
      activeQuestion: null,
      buzzerQueue: [],
      finalChallengeWagers: {},
      doublePlayerId: null,
      doubleWager: null,
      challengeState: null,
    });

    socket.join(`session:${sessionId}`);
    socket.join(`host:${sessionId}`);

    ack({ sessionId, hostToken, tunnelUrl, localUrl });
  });

  // PLAYER: entrar na sessão
  socket.on('player:join', (payload) => {
    if (!socketRateLimit(socket.id, 'player:join', 3)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Muitas tentativas.' });
      return;
    }

    const code = payload.joinCode.toUpperCase();
    if (!isValidJoinCode(code)) {
      socket.emit('error', { code: 'INVALID_JOIN_CODE', message: 'Código de sala inválido.' });
      return;
    }

    const session = getSession(code);
    if (!session) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Sala não encontrada ou expirada.' });
      return;
    }

    if (session.phase !== 'lobby') {
      socket.emit('error', { code: 'GAME_ALREADY_STARTED', message: 'O jogo já começou.' });
      return;
    }

    if (Object.keys(session.players).length >= MAX_PLAYERS) {
      socket.emit('error', { code: 'SESSION_FULL', message: 'Sala cheia.' });
      return;
    }

    const name = sanitizePlayerName(payload.playerName);
    if (!name) {
      socket.emit('error', { code: 'INVALID_NAME', message: 'Nome inválido.' });
      return;
    }

    const colorIndex = Object.keys(session.players).length % AVATAR_COLORS.length;
    const player = {
      id: socket.id,
      name,
      role: 'player' as const,
      score: 0,
      isConnected: true,
      joinedAt: Date.now(),
      avatarColor: AVATAR_COLORS[colorIndex],
    };

    const updatedPlayers = { ...session.players, [socket.id]: player };
    updateSession(code, { players: updatedPlayers });

    socket.join(`session:${code}`);
    socket.join(`player:${socket.id}`);

    io.to(`session:${code}`).emit('player:joined', {
      player,
      allPlayers: Object.values(updatedPlayers),
    });
  });

  // Desconexão
  socket.on('disconnect', () => {
    // Verificar se era host
    const hostSession = Array.from(
      (io.sockets as unknown as { adapter: { rooms: Map<string, Set<string>> } }).adapter.rooms.entries()
    ).find(([room]) => room.startsWith('host:'));

    // Procurar em sessões ativas
    const playerSession = getSessionByPlayerId(socket.id);
    if (playerSession) {
      const updated = { ...playerSession.players };
      if (updated[socket.id]) {
        updated[socket.id] = { ...updated[socket.id], isConnected: false };
        updateSession(playerSession.sessionId, { players: updated });
        io.to(`session:${playerSession.sessionId}`).emit('player:left', {
          playerId: socket.id,
          allPlayers: Object.values(updated),
        });
      }
    }
  });
}
