import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerLobbyHandlers } from '../../handlers/lobbyHandler.js';
import { getSession, deleteSession, updateSession } from '../../managers/sessionManager.js';
import { makeMockSocket, makeMockIo } from '../helpers/mockSocket.js';
import { TEST_SESSION_ID } from '../helpers/sessionFixture.js';

vi.mock('../../middleware/rateLimiter.js', () => ({
  socketRateLimit: vi.fn(() => true),
  apiLimiter: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  MAX_PLAYERS: 10,
  SESSION_TTL_MS: 4 * 60 * 60 * 1000,
  RUNTIME_SECRET: 'test-secret-key-32-bytes-long!!!',
  DEFAULT_TIMER_MS: 30000,
  GAMES_DIR: '/tmp/test-games',
  MEDIA_MAX_MB: 10,
  PORT: 3000,
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  HOST_GRACE_PERIOD_MS: 30000,
}));

vi.mock('../../storage/fileStorage.js', () => ({
  loadGame: vi.fn(async (id: string) => {
    if (id === 'valid-game') {
      return {
        id: 'valid-game',
        name: 'Test Game',
        description: '',
        categories: [{ id: 'cat-1', name: 'Cat', questions: [] }],
        defaultTimer: 60,
        finalChallengeEnabled: false,
        finalChallengeClue: '',
        finalChallengeAnswer: '',
        version: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
    }
    return null;
  }),
}));

beforeEach(() => {
  deleteSession(TEST_SESSION_ID);
});

let hostSocketCounter = 0;
async function createSession(): Promise<string> {
  const socket = makeMockSocket(`host-sock-${++hostSocketCounter}`);
  const io = makeMockIo();
  registerLobbyHandlers(io as any, socket as any);
  let sessionId = '';
  socket.trigger('host:create', { gameConfigId: 'valid-game' }, (result: any) => {
    sessionId = result.sessionId;
  });
  await new Promise((r) => setTimeout(r, 10));
  return sessionId;
}

describe('host:create', () => {
  it('cria sessão com jogo válido e retorna sessionId + hostToken', async () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    let result: any;
    socket.trigger('host:create', { gameConfigId: 'valid-game' }, (r: any) => { result = r; });
    await new Promise((r) => setTimeout(r, 10));
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('hostToken');
    expect(result.sessionId).toHaveLength(6);
  });

  it('retorna erro para jogo inexistente', async () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    let result: any;
    socket.trigger('host:create', { gameConfigId: 'nonexistent' }, (r: any) => { result = r; });
    await new Promise((r) => setTimeout(r, 10));
    expect(result).toMatchObject({ code: 'GAME_NOT_FOUND' });
  });

  it('reseta questões usadas ao criar sessão', async () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    let sessionId = '';
    socket.trigger('host:create', { gameConfigId: 'valid-game' }, (r: any) => { sessionId = r.sessionId; });
    await new Promise((r) => setTimeout(r, 10));
    const session = getSession(sessionId);
    const allUnused = session?.gameConfig.categories
      .flatMap((c) => c.questions)
      .every((q) => !q.used);
    expect(allUnused).toBe(true);
  });
});

describe('player:join', () => {
  it('jogador entra em sessão válida', async () => {
    const sessionId = await createSession();
    const socket = makeMockSocket('player-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: sessionId, playerName: 'Alice' });
    expect(io.emitted.some((e) => e.event === 'player:joined')).toBe(true);
  });

  it('emite erro para código inválido', () => {
    const socket = makeMockSocket('p-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: 'INVALID!!', playerName: 'Alice' });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('emite erro para sessão inexistente', () => {
    const socket = makeMockSocket('p-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: 'ABCDEF', playerName: 'Alice' });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('emite erro quando jogo já começou', async () => {
    const sessionId = await createSession();
    updateSession(sessionId, { phase: 'board' });
    const socket = makeMockSocket('p2-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: sessionId, playerName: 'Bob' });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('emite erro para nome vazio', async () => {
    const sessionId = await createSession();
    const socket = makeMockSocket('p3-socket');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: sessionId, playerName: '   ' });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('atribui cor de avatar diferente para cada jogador', async () => {
    const sessionId = await createSession();
    const io = makeMockIo();
    for (let i = 0; i < 3; i++) {
      const ps = makeMockSocket(`ps-${i}`);
      registerLobbyHandlers(io as any, ps as any);
      ps.trigger('player:join', { joinCode: sessionId, playerName: `Player${i}` });
    }
    const session = getSession(sessionId);
    const colors = Object.values(session?.players ?? {}).map((p) => p.avatarColor);
    expect(new Set(colors).size).toBe(3);
  });

  it('emite erro quando sala cheia', async () => {
    const sessionId = await createSession();
    // Adiciona 10 jogadores
    for (let i = 0; i < 10; i++) {
      const ps = makeMockSocket(`full-ps-${i}`);
      const io2 = makeMockIo();
      registerLobbyHandlers(io2 as any, ps as any);
      ps.trigger('player:join', { joinCode: sessionId, playerName: `P${i}` });
    }
    const socket = makeMockSocket('overflow');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: sessionId, playerName: 'Extra' });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('disconnect', () => {
  it('marca jogador como desconectado ao sair', async () => {
    const sessionId = await createSession();
    const socket = makeMockSocket('d-player');
    const io = makeMockIo();
    registerLobbyHandlers(io as any, socket as any);
    socket.trigger('player:join', { joinCode: sessionId, playerName: 'Dan' });
    socket.trigger('disconnect');
    const session = getSession(sessionId);
    const player = session?.players['d-player'];
    expect(player?.isConnected).toBe(false);
  });
});
