import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFinalHandlers } from '../../handlers/finalHandler.js';
import { getSession } from '../../managers/sessionManager.js';
import { makeMockSocket, makeMockIo } from '../helpers/mockSocket.js';
import { setupSession, HOST_TOKEN, TEST_SESSION_ID } from '../helpers/sessionFixture.js';

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

beforeEach(() => {
  setupSession({ phase: 'answer_reveal' });
});

function setupHost() {
  const socket = makeMockSocket('host-socket');
  const io = makeMockIo();
  registerFinalHandlers(io as any, socket as any);
  return { socket, io };
}

function setupPlayer(socketId: string) {
  const socket = makeMockSocket(socketId);
  const io = makeMockIo();
  registerFinalHandlers(io as any, socket as any);
  return { socket, io };
}

describe('host:startFinal', () => {
  it('transita para final_challenge e emite final:started', () => {
    const { socket, io } = setupHost();
    socket.trigger('host:startFinal', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('final_challenge');
    expect(io.emitted.some((e) => e.event === 'final:started')).toBe(true);
  });

  it('emite final:hostDetails apenas para host', () => {
    const { socket, io } = setupHost();
    socket.trigger('host:startFinal', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    const hostDetails = io.getEmittedTo(`host:${TEST_SESSION_ID}`).find((e) => e.event === 'final:hostDetails');
    expect(hostDetails).toBeDefined();
    expect((hostDetails?.args[0] as any)?.correctAnswer).toBe('Final answer');
  });

  it('emite erro se transição inválida', () => {
    setupSession({ phase: 'lobby' });
    const { socket } = setupHost();
    socket.trigger('host:startFinal', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('player:finalWager', () => {
  beforeEach(() => {
    setupSession({ phase: 'final_challenge', finalChallengeWagers: {} });
  });

  it('registra aposta e emite confirmação', () => {
    const { socket, io } = setupPlayer('player-1');
    socket.trigger('player:finalWager', {
      sessionId: TEST_SESSION_ID,
      amount: 300,
      answer: 'Minha resposta',
    });
    const wager = getSession(TEST_SESSION_ID)?.finalChallengeWagers['player-1'];
    expect(wager?.amount).toBe(300);
    expect(wager?.answer).toBe('Minha resposta');
    expect(io.emitted.some((e) => e.event === 'final:wagerConfirmed')).toBe(true);
  });

  it('limita aposta ao score máximo (score positivo)', () => {
    const { socket } = setupPlayer('player-1');
    socket.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 9999, answer: 'x' });
    expect(getSession(TEST_SESSION_ID)?.finalChallengeWagers['player-1']?.amount).toBe(500); // score de Alice
  });

  it('limita aposta a 0 quando score negativo', () => {
    setupSession({
      phase: 'final_challenge',
      finalChallengeWagers: {},
      players: {
        'player-1': { id: 'player-1', name: 'Alice', role: 'player', score: -100, isConnected: true, joinedAt: 0, avatarColor: '#fff' },
        'player-2': { id: 'player-2', name: 'Bob', role: 'player', score: 300, isConnected: true, joinedAt: 0, avatarColor: '#fff' },
      },
    });
    const { socket } = setupPlayer('player-1');
    socket.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 100, answer: 'x' });
    expect(getSession(TEST_SESSION_ID)?.finalChallengeWagers['player-1']?.amount).toBe(0);
  });

  it('não permite re-envio de aposta', () => {
    const { socket } = setupPlayer('player-1');
    socket.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 100, answer: 'first' });
    socket.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 200, answer: 'second' });
    expect(getSession(TEST_SESSION_ID)?.finalChallengeWagers['player-1']?.answer).toBe('first');
  });

  it('sanitiza resposta do jogador', () => {
    const { socket } = setupPlayer('player-1');
    socket.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 100, answer: '  com espaços  ' });
    expect(getSession(TEST_SESSION_ID)?.finalChallengeWagers['player-1']?.answer).toBe('com espaços');
  });

  it('transita para final_reveal quando todos apostaram', () => {
    // Apenas player-1 e player-2 na sessão
    const { socket: s1 } = setupPlayer('player-1');
    const { socket: s2 } = setupPlayer('player-2');
    s1.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 100, answer: 'a' });
    s2.trigger('player:finalWager', { sessionId: TEST_SESSION_ID, amount: 50, answer: 'b' });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('final_reveal');
  });
});

describe('host:revealFinal', () => {
  beforeEach(() => {
    setupSession({
      phase: 'final_reveal',
      finalChallengeWagers: {
        'player-1': { playerId: 'player-1', amount: 200, answer: 'right', revealed: false },
        'player-2': { playerId: 'player-2', amount: 100, answer: 'wrong', revealed: false },
      },
    });
  });

  it('resposta correta: +wager', () => {
    const { socket } = setupHost();
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      isCorrect: true,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(700); // 500 + 200
  });

  it('resposta errada: -wager', () => {
    const { socket } = setupHost();
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      isCorrect: false,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(300); // 500 - 200
  });

  it('emite final:revealed e score:update', () => {
    const { socket, io } = setupHost();
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      isCorrect: true,
    });
    expect(io.emitted.some((e) => e.event === 'final:revealed')).toBe(true);
    expect(io.emitted.some((e) => e.event === 'score:update')).toBe(true);
  });

  it('transita para game_over quando todos revelados', () => {
    const { socket, io } = setupHost();
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      isCorrect: true,
    });
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-2',
      isCorrect: false,
    });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('game_over');
    expect(io.emitted.some((e) => e.event === 'game:over')).toBe(true);
  });

  it('não revela aposta já revelada', () => {
    setupSession({
      phase: 'final_reveal',
      finalChallengeWagers: {
        'player-1': { playerId: 'player-1', amount: 200, answer: 'right', revealed: true },
      },
    });
    const { socket, io } = setupHost();
    const countBefore = io.emitted.length;
    socket.trigger('host:revealFinal', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      isCorrect: true,
    });
    expect(io.emitted.length).toBe(countBefore);
  });
});
