import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerBuzzerHandlers } from '../../handlers/buzzerHandler.js';
import { getSession } from '../../managers/sessionManager.js';
import { makeMockSocket, makeMockIo } from '../helpers/mockSocket.js';
import { setupSession, HOST_TOKEN, TEST_SESSION_ID, makePlayer } from '../helpers/sessionFixture.js';

vi.mock('../../middleware/rateLimiter.js', () => ({
  socketRateLimit: vi.fn(() => true),
  apiLimiter: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  DEFAULT_TIMER_MS: 30000,
  SESSION_TTL_MS: 4 * 60 * 60 * 1000,
  RUNTIME_SECRET: 'test-secret-key-32-bytes-long!!!',
  MAX_PLAYERS: 10,
  GAMES_DIR: '/tmp/test-games',
  MEDIA_MAX_MB: 10,
  PORT: 3000,
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  HOST_GRACE_PERIOD_MS: 30000,
}));

beforeEach(() => {
  vi.useFakeTimers();
  setupSession({
    phase: 'question',
    activeQuestion: {
      categoryId: 'cat-1',
      questionId: 'q-1',
      question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
      startedAt: Date.now(),
      timerDuration: 30000,
    },
    buzzerQueue: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(socketId = 'player-1') {
  const socket = makeMockSocket(socketId);
  const io = makeMockIo();
  registerBuzzerHandlers(io as any, socket as any);
  return { socket, io };
}

describe('player:buzz', () => {
  it('adiciona jogador à fila e confirma posição', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    const confirmed = socket.emitted.find((e) => e.event === 'buzzer:confirmed');
    expect(confirmed).toBeDefined();
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('buzzer_queue');
  });

  it('transita para buzzer_queue', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('buzzer_queue');
  });

  it('não adiciona jogador duplicado', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    expect(getSession(TEST_SESSION_ID)?.buzzerQueue.length).toBe(1);
  });

  it('não aceita buzz em fase errada', () => {
    setupSession({ phase: 'board' });
    const { socket } = setup('player-1');
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    expect(getSession(TEST_SESSION_ID)?.buzzerQueue.length).toBe(0);
  });

  it('não aceita buzz de jogador inexistente na sessão', () => {
    const { socket } = setup('ghost-player');
    socket.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    expect(getSession(TEST_SESSION_ID)?.buzzerQueue.length).toBe(0);
  });

  it('ordena fila por timestamp', () => {
    const socket1 = makeMockSocket('player-1');
    const socket2 = makeMockSocket('player-2');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket1 as any);
    registerBuzzerHandlers(io as any, socket2 as any);

    socket1.trigger('player:buzz', { sessionId: TEST_SESSION_ID });
    vi.advanceTimersByTime(10);
    socket2.trigger('player:buzz', { sessionId: TEST_SESSION_ID });

    const queue = getSession(TEST_SESSION_ID)?.buzzerQueue;
    expect(queue?.[0]?.playerId).toBe('player-1');
    expect(queue?.[1]?.playerId).toBe('player-2');
  });
});

describe('host:judge — scoring standard', () => {
  beforeEach(() => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [{ playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false }],
    });
  });

  it('resposta correta: +value', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      correct: true,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(600); // 500 + 100
  });

  it('resposta errada: -value', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      correct: false,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(400); // 500 - 100
  });

  it('emite judge:result', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      correct: true,
    });
    expect(io.emitted.some((e) => e.event === 'judge:result')).toBe(true);
    expect(io.emitted.some((e) => e.event === 'score:update')).toBe(true);
  });
});

describe('host:judge — scoring challenge', () => {
  beforeEach(() => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-4',
        question: { id: 'q-4', value: 400, clue: 'Q', answer: 'A', type: 'challenge', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [{ playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false }],
      challengeState: {
        challengerId: 'player-1',
        challengerName: 'Alice',
        challengedId: 'player-2',
        challengedName: 'Bob',
      },
    });
  });

  it('desafiado acerta: +value, desafiador -50%', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-2',
      correct: true,
    });
    const session = getSession(TEST_SESSION_ID);
    expect(session?.players['player-2']?.score).toBe(700); // 300 + 400
    expect(session?.players['player-1']?.score).toBe(300); // 500 - 200 (50% de 400)
  });

  it('desafiado erra: -value, desafiador +50%', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-2',
      correct: false,
    });
    const session = getSession(TEST_SESSION_ID);
    expect(session?.players['player-2']?.score).toBe(-100); // 300 - 400
    expect(session?.players['player-1']?.score).toBe(700); // 500 + 200 (50% de 400)
  });
});

describe('host:judge — scoring double wager', () => {
  beforeEach(() => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-3',
        question: { id: 'q-3', value: 300, clue: 'Q', answer: 'A', type: 'double', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [{ playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false }],
      doubleWager: 250,
    });
  });

  it('acerta: +wager', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      correct: true,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(750); // 500 + 250
  });

  it('erra: -wager', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:judge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      correct: false,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(250); // 500 - 250
  });
});

describe('host:skipPlayer', () => {
  beforeEach(() => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [
        { playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false },
        { playerId: 'player-2', playerName: 'Bob', timestamp: 2, responded: false },
      ],
    });
  });

  it('marca jogador como respondido e avança fila', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:skipPlayer', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
    });
    const queue = getSession(TEST_SESSION_ID)?.buzzerQueue;
    expect(queue?.[0]?.responded).toBe(true);
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('buzzer_queue');
  });

  it('transita para board quando fila esgota', () => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [{ playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false }],
    });
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:skipPlayer', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
    });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('answer_reveal');
  });
});

describe('host:setChallenge', () => {
  beforeEach(() => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-4',
        question: { id: 'q-4', value: 400, clue: 'Q', answer: 'A', type: 'challenge', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      buzzerQueue: [{ playerId: 'player-1', playerName: 'Alice', timestamp: 1, responded: false }],
      challengeState: null,
    });
  });

  it('atribui challengeState e emite challenge:assigned', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:setChallenge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      challengedId: 'player-2',
    });
    const session = getSession(TEST_SESSION_ID);
    expect(session?.challengeState?.challengerId).toBe('player-1');
    expect(session?.challengeState?.challengedId).toBe('player-2');
    expect(io.emitted.some((e) => e.event === 'challenge:assigned')).toBe(true);
  });

  it('emite erro para jogador desafiado inexistente', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    registerBuzzerHandlers(io as any, socket as any);
    socket.trigger('host:setChallenge', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      challengedId: 'ghost',
    });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('player:doubleWager', () => {
  beforeEach(() => {
    setupSession({
      phase: 'double_wager',
      doublePlayerId: 'player-1',
      doubleWager: null,
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-3',
        question: { id: 'q-3', value: 300, clue: 'Q', answer: 'A', type: 'double', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
  });

  it('registra aposta e transita para question', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:doubleWager', { sessionId: TEST_SESSION_ID, amount: 200 });
    expect(getSession(TEST_SESSION_ID)?.doubleWager).toBe(200);
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('question');
  });

  it('limita aposta ao máximo (score ou valor da questão)', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:doubleWager', { sessionId: TEST_SESSION_ID, amount: 9999 });
    // player-1 tem score=500, questão vale 300, max = max(500, 300) = 500
    expect(getSession(TEST_SESSION_ID)?.doubleWager).toBe(500);
  });

  it('não aceita de jogador que não é o atribuído', () => {
    const { socket } = setup('player-2');
    socket.trigger('player:doubleWager', { sessionId: TEST_SESSION_ID, amount: 100 });
    expect(getSession(TEST_SESSION_ID)?.doubleWager).toBeNull();
  });

  it('não aceita segunda aposta', () => {
    const { socket } = setup('player-1');
    socket.trigger('player:doubleWager', { sessionId: TEST_SESSION_ID, amount: 100 });
    socket.trigger('player:doubleWager', { sessionId: TEST_SESSION_ID, amount: 200 });
    expect(getSession(TEST_SESSION_ID)?.doubleWager).toBe(100);
  });
});
