import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { socketRateLimit } from '../../middleware/rateLimiter.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('socketRateLimit', () => {
  it('permite a primeira chamada', () => {
    expect(socketRateLimit('socket-1', 'player:buzz', 3)).toBe(true);
  });

  it('permite até o limite por segundo', () => {
    const socketId = `s-${Date.now()}-1`;
    expect(socketRateLimit(socketId, 'buzz', 3)).toBe(true);
    expect(socketRateLimit(socketId, 'buzz', 3)).toBe(true);
    expect(socketRateLimit(socketId, 'buzz', 3)).toBe(true);
  });

  it('bloqueia quando excede o limite', () => {
    const socketId = `s-${Date.now()}-2`;
    socketRateLimit(socketId, 'buzz', 3);
    socketRateLimit(socketId, 'buzz', 3);
    socketRateLimit(socketId, 'buzz', 3);
    expect(socketRateLimit(socketId, 'buzz', 3)).toBe(false);
  });

  it('reseta após 1 segundo', () => {
    const socketId = `s-${Date.now()}-3`;
    socketRateLimit(socketId, 'buzz', 1);
    expect(socketRateLimit(socketId, 'buzz', 1)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(socketRateLimit(socketId, 'buzz', 1)).toBe(true);
  });

  it('eventos diferentes têm contadores separados', () => {
    const socketId = `s-${Date.now()}-4`;
    expect(socketRateLimit(socketId, 'event-a', 1)).toBe(true);
    expect(socketRateLimit(socketId, 'event-b', 1)).toBe(true);
    expect(socketRateLimit(socketId, 'event-a', 1)).toBe(false);
    expect(socketRateLimit(socketId, 'event-b', 1)).toBe(false);
  });

  it('sockets diferentes têm contadores separados', () => {
    vi.advanceTimersByTime(100);
    const socketA = `sa-${Date.now()}`;
    const socketB = `sb-${Date.now()}`;
    socketRateLimit(socketA, 'buzz', 1);
    expect(socketRateLimit(socketA, 'buzz', 1)).toBe(false);
    expect(socketRateLimit(socketB, 'buzz', 1)).toBe(true);
  });

  it('limit=1 bloqueia a segunda chamada', () => {
    const socketId = `s-${Date.now()}-5`;
    expect(socketRateLimit(socketId, 'join', 1)).toBe(true);
    expect(socketRateLimit(socketId, 'join', 1)).toBe(false);
  });
});
