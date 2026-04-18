import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getSessionByHostId,
  getSessionByPlayerId,
  cleanupExpiredSessions,
} from '../../managers/sessionManager.js';
import type { GameSession } from '@jeopardy/shared';

vi.mock('../../config.js', () => ({
  SESSION_TTL_MS: 4 * 60 * 60 * 1000,
  RUNTIME_SECRET: 'test-secret-key-32-bytes-long!!!',
  DEFAULT_TIMER_MS: 30000,
  MAX_PLAYERS: 10,
  GAMES_DIR: '/tmp/test-games',
  MEDIA_MAX_MB: 10,
  PORT: 3000,
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  HOST_GRACE_PERIOD_MS: 30000,
}));

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    sessionId: 'SESS01',
    hostId: 'host-socket-id',
    hostToken: 'token-abc',
    gameConfig: {
      id: 'game1',
      name: 'Test Game',
      description: '',
      categories: [],
      defaultTimer: 60,
      finalChallengeEnabled: false,
      finalChallengeClue: '',
      finalChallengeAnswer: '',
      version: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    players: {},
    phase: 'lobby',
    activeQuestion: null,
    buzzerQueue: [],
    finalChallengeWagers: {},
    doublePlayerId: null,
    doubleWager: null,
    challengeState: null,
    startedAt: undefined,
    endedAt: undefined,
    ...overrides,
  };
}

// Reset sessions entre testes limpando via delete
beforeEach(() => {
  // Limpar todas as sessões existentes
  const session1 = getSession('SESS01');
  if (session1) deleteSession('SESS01');
  const session2 = getSession('SESS02');
  if (session2) deleteSession('SESS02');
  ['SESS01', 'SESS02', 'CLEANUP1', 'CLEANUP2', 'CLEANUP3'].forEach((id) => deleteSession(id));
});

describe('createSession / getSession', () => {
  it('cria e recupera uma sessão', () => {
    const session = makeSession();
    createSession(session);
    expect(getSession('SESS01')).toEqual(session);
  });

  it('retorna undefined para sessão inexistente', () => {
    expect(getSession('NOPE')).toBeUndefined();
  });

  it('sobrescreve sessão existente com mesmo ID', () => {
    createSession(makeSession({ hostId: 'host-1' }));
    createSession(makeSession({ hostId: 'host-2' }));
    expect(getSession('SESS01')?.hostId).toBe('host-2');
  });
});

describe('updateSession', () => {
  it('atualiza campos específicos', () => {
    createSession(makeSession());
    const updated = updateSession('SESS01', { phase: 'board' });
    expect(updated?.phase).toBe('board');
    expect(getSession('SESS01')?.phase).toBe('board');
  });

  it('retorna null para sessão inexistente', () => {
    expect(updateSession('NOPE', { phase: 'board' })).toBeNull();
  });

  it('merge parcial sem sobrescrever outros campos', () => {
    const session = makeSession({ hostId: 'host-original' });
    createSession(session);
    updateSession('SESS01', { phase: 'board' });
    expect(getSession('SESS01')?.hostId).toBe('host-original');
  });
});

describe('deleteSession', () => {
  it('remove sessão existente', () => {
    createSession(makeSession());
    deleteSession('SESS01');
    expect(getSession('SESS01')).toBeUndefined();
  });

  it('não lança erro ao deletar sessão inexistente', () => {
    expect(() => deleteSession('NOPE')).not.toThrow();
  });
});

describe('getSessionByHostId', () => {
  it('encontra sessão pelo hostId', () => {
    createSession(makeSession({ hostId: 'unique-host' }));
    expect(getSessionByHostId('unique-host')?.sessionId).toBe('SESS01');
  });

  it('retorna undefined para hostId inexistente', () => {
    expect(getSessionByHostId('ghost')).toBeUndefined();
  });
});

describe('getSessionByPlayerId', () => {
  it('encontra sessão pelo playerId', () => {
    createSession(makeSession({
      players: { 'player-socket': { id: 'player-socket', name: 'Alice', role: 'player', score: 0, isConnected: true, joinedAt: 0, avatarColor: '#fff' } },
    }));
    expect(getSessionByPlayerId('player-socket')?.sessionId).toBe('SESS01');
  });

  it('retorna undefined para playerId inexistente', () => {
    expect(getSessionByPlayerId('ghost')).toBeUndefined();
  });
});

describe('cleanupExpiredSessions', () => {
  it('remove sessão game_over com endedAt há mais de 60s', () => {
    createSession(makeSession({
      sessionId: 'CLEANUP1',
      phase: 'game_over',
      endedAt: Date.now() - 70_000,
    }));
    cleanupExpiredSessions();
    expect(getSession('CLEANUP1')).toBeUndefined();
  });

  it('NÃO remove sessão game_over com endedAt recente', () => {
    createSession(makeSession({
      sessionId: 'CLEANUP2',
      phase: 'game_over',
      endedAt: Date.now() - 10_000,
    }));
    cleanupExpiredSessions();
    expect(getSession('CLEANUP2')).toBeDefined();
  });

  it('remove sessão com TTL expirado', () => {
    createSession(makeSession({
      sessionId: 'CLEANUP3',
      startedAt: Date.now() - (5 * 60 * 60 * 1000), // 5h atrás
    }));
    cleanupExpiredSessions();
    expect(getSession('CLEANUP3')).toBeUndefined();
  });
});
