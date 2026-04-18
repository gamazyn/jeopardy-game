import { describe, it, expect, vi } from 'vitest';
import { generateHostToken, validateHostToken } from '../../middleware/authMiddleware.js';

vi.mock('../../config.js', () => ({
  RUNTIME_SECRET: 'test-secret-key-32-bytes-long!!!',
  SESSION_TTL_MS: 4 * 60 * 60 * 1000,
  DEFAULT_TIMER_MS: 30000,
  MAX_PLAYERS: 10,
  GAMES_DIR: '/tmp/test-games',
  MEDIA_MAX_MB: 10,
  PORT: 3000,
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  HOST_GRACE_PERIOD_MS: 30000,
}));

describe('generateHostToken', () => {
  it('retorna string hexadecimal de 64 caracteres (SHA-256)', () => {
    const token = generateHostToken('session-123');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('gera tokens diferentes para a mesma sessão (timestamp+uuid)', () => {
    const t1 = generateHostToken('session-123');
    const t2 = generateHostToken('session-123');
    expect(t1).not.toBe(t2);
  });

  it('gera tokens diferentes para sessões diferentes', () => {
    const t1 = generateHostToken('session-A');
    const t2 = generateHostToken('session-B');
    expect(t1).not.toBe(t2);
  });
});

describe('validateHostToken', () => {
  it('retorna true para tokens idênticos', () => {
    const token = generateHostToken('sess');
    expect(validateHostToken(token, token)).toBe(true);
  });

  it('retorna false para token errado', () => {
    const token = generateHostToken('sess');
    const wrong = 'a'.repeat(64);
    expect(validateHostToken(token, wrong)).toBe(false);
  });

  it('retorna false para token vazio', () => {
    const token = generateHostToken('sess');
    expect(validateHostToken(token, '')).toBe(false);
  });

  it('retorna false para token com comprimento diferente', () => {
    const token = generateHostToken('sess');
    expect(validateHostToken(token, token.slice(0, 32))).toBe(false);
  });

  it('é timing-safe: não lança para tokens de qualquer comprimento', () => {
    const token = generateHostToken('sess');
    expect(() => validateHostToken(token, 'short')).not.toThrow();
  });

  it('retorna false quando storedToken e providedToken são diferentes mas mesmo comprimento', () => {
    const t1 = generateHostToken('sess-1');
    const t2 = generateHostToken('sess-2');
    expect(validateHostToken(t1, t2)).toBe(false);
  });
});
