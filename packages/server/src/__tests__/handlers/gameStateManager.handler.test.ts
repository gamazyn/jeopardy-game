import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerGameHandlers, closeQuestion, closeQuestionNoReveal, continueBoard } from '../../handlers/gameHandler.js';
import { getSession } from '../../managers/sessionManager.js';
import { makeMockSocket, makeMockIo } from '../helpers/mockSocket.js';
import { setupSession, HOST_TOKEN, TEST_SESSION_ID } from '../helpers/sessionFixture.js';

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
  setupSession({ phase: 'board' });
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(socketId = 'host-socket') {
  const socket = makeMockSocket(socketId);
  const io = makeMockIo();
  registerGameHandlers(io as any, socket as any);
  return { socket, io };
}

describe('host:start', () => {
  it('transita lobby → board e emite game:started', () => {
    setupSession({ phase: 'lobby' });
    const { socket, io } = setup();
    socket.trigger('host:start', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('board');
    const started = io.emitted.find((e) => e.event === 'game:started');
    expect(started).toBeDefined();
  });

  it('emite erro se fase inválida', () => {
    setupSession({ phase: 'game_over' });
    const { socket } = setup();
    socket.trigger('host:start', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    const err = socket.emitted.find((e) => e.event === 'error');
    expect(err?.args[0]).toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('emite erro se sem jogadores', () => {
    setupSession({ phase: 'lobby', players: {} });
    const { socket } = setup();
    socket.trigger('host:start', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    const err = socket.emitted.find((e) => e.event === 'error');
    expect(err?.args[0]).toMatchObject({ code: 'NO_PLAYERS' });
  });

  it('emite erro se sessão não existe', () => {
    const { socket } = setup();
    socket.trigger('host:start', { sessionId: 'NOPE', hostToken: HOST_TOKEN });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('host:selectQuestion', () => {
  it('seleciona questão standard e transita para question', () => {
    const { socket, io } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'q-1',
    });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('question');
    expect(io.emitted.some((e) => e.event === 'question:selected')).toBe(true);
  });

  it('seleciona questão all_play e transita para all_play', () => {
    const { socket } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'q-2',
    });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('all_play');
  });

  it('seleciona questão double e transita para double_wager', () => {
    const { socket, io } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'q-3',
    });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('double_wager');
    expect(io.emitted.some((e) => e.event === 'double:started')).toBe(true);
  });

  it('emite erro para questão já usada', () => {
    const { socket } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'q-used',
    });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('emite erro para questão inexistente', () => {
    const { socket } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'nonexistent',
    });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('emite erro se fase inválida', () => {
    setupSession({ phase: 'question' });
    const { socket } = setup();
    socket.trigger('host:selectQuestion', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      categoryId: 'cat-1',
      questionId: 'q-1',
    });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('host:adjustScore', () => {
  it('ajusta score de um jogador', () => {
    const { socket, io } = setup();
    socket.trigger('host:adjustScore', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      delta: 100,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(600);
    expect(io.emitted.some((e) => e.event === 'score:update')).toBe(true);
  });

  it('score negativo diminui pontuação', () => {
    const { socket } = setup();
    socket.trigger('host:adjustScore', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
      delta: -200,
    });
    expect(getSession(TEST_SESSION_ID)?.players['player-1']?.score).toBe(300);
  });

  it('não altera nada se jogador não existe', () => {
    const { socket, io } = setup();
    const emitCount = io.emitted.length;
    socket.trigger('host:adjustScore', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'ghost',
      delta: 100,
    });
    expect(io.emitted.length).toBe(emitCount);
  });
});

describe('host:assignDouble', () => {
  it('atribui jogador para dupla aposta', () => {
    setupSession({ phase: 'double_wager' });
    const { socket, io } = setup();
    socket.trigger('host:assignDouble', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'player-1',
    });
    expect(getSession(TEST_SESSION_ID)?.doublePlayerId).toBe('player-1');
    expect(io.emitted.some((e) => e.event === 'double:started')).toBe(true);
  });

  it('emite erro se jogador não existe', () => {
    setupSession({ phase: 'double_wager' });
    const { socket } = setup();
    socket.trigger('host:assignDouble', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      playerId: 'ghost',
    });
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });
});

describe('host:endGame', () => {
  it('transita para game_over e emite game:over com placar ordenado', () => {
    const { socket, io } = setup();
    socket.trigger('host:endGame', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('game_over');
    const over = io.emitted.find((e) => e.event === 'game:over');
    expect(over).toBeDefined();
    // Alice (500) deve ser primeiro
    expect((over?.args[0] as any)?.finalScores[0]?.name).toBe('Alice');
  });
});

describe('host:timerControl', () => {
  it('pause não lança erro', () => {
    const { socket } = setup();
    expect(() => socket.trigger('host:timerControl', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      action: 'pause',
    })).not.toThrow();
  });

  it('extend não lança erro', () => {
    const { socket } = setup();
    expect(() => socket.trigger('host:timerControl', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      action: 'extend',
      seconds: 30,
    })).not.toThrow();
  });
});

describe('host:timerControl resume/set', () => {
  it('resume não lança erro', () => {
    const { socket } = setup();
    expect(() => socket.trigger('host:timerControl', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      action: 'resume',
    })).not.toThrow();
  });

  it('set não lança erro', () => {
    const { socket } = setup();
    expect(() => socket.trigger('host:timerControl', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      action: 'set',
      seconds: 60,
    })).not.toThrow();
  });
});

describe('host:clearQuestion', () => {
  it('vai para answer_reveal e emite question:answerReveal', () => {
    setupSession({
      phase: 'question',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const { socket, io } = setup();
    socket.trigger('host:clearQuestion', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('answer_reveal');
    expect(io.emitted.some((e) => e.event === 'question:answerReveal')).toBe(true);
  });
});

describe('host:clearQuestionNoReveal', () => {
  it('vai direto para board e emite question:closed', () => {
    setupSession({
      phase: 'question',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const { socket, io } = setup();
    socket.trigger('host:clearQuestionNoReveal', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('board');
    expect(io.emitted.some((e) => e.event === 'question:closed')).toBe(true);
  });
});

describe('host:continueBoard', () => {
  it('vai de answer_reveal para board quando há questões', () => {
    setupSession({
      phase: 'answer_reveal',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const { socket, io } = setup();
    socket.trigger('host:continueBoard', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('board');
    expect(io.emitted.some((e) => e.event === 'question:closed')).toBe(true);
  });

  it('vai para final_challenge quando todas questões usadas e final habilitado', () => {
    setupSession({
      phase: 'answer_reveal',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
      gameConfig: {
        id: 'game-1',
        name: 'Test',
        description: '',
        categories: [{
          id: 'cat-1',
          name: 'Cat',
          questions: [{ id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard' as const, used: true }],
        }],
        defaultTimer: 30,
        finalChallengeEnabled: true,
        finalChallengeClue: 'Final',
        finalChallengeAnswer: 'Answer',
        version: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    });
    const { socket, io } = setup();
    socket.trigger('host:continueBoard', { sessionId: TEST_SESSION_ID, hostToken: HOST_TOKEN });
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('final_challenge');
  });
});

describe('closeQuestion (exported)', () => {
  it('marca questão como usada e emite answerReveal', () => {
    setupSession({
      phase: 'buzzer_queue',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const io = makeMockIo();
    closeQuestion(io as any, TEST_SESSION_ID, true);
    const session = getSession(TEST_SESSION_ID);
    expect(session?.phase).toBe('answer_reveal');
    const usedQ = session?.gameConfig.categories[0]?.questions.find((q) => q.id === 'q-1');
    expect(usedQ?.used).toBe(true);
  });
});

describe('closeQuestionNoReveal (exported)', () => {
  it('fecha questão sem revelar e vai para board', () => {
    setupSession({
      phase: 'question',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const io = makeMockIo();
    closeQuestionNoReveal(io as any, TEST_SESSION_ID);
    expect(getSession(TEST_SESSION_ID)?.phase).toBe('board');
    expect(io.emitted.some((e) => e.event === 'question:closed')).toBe(true);
  });
});

describe('continueBoard (exported)', () => {
  it('limpa questão ativa e emite question:closed', () => {
    setupSession({
      phase: 'answer_reveal',
      activeQuestion: {
        categoryId: 'cat-1',
        questionId: 'q-1',
        question: { id: 'q-1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
        startedAt: Date.now(),
        timerDuration: 30000,
      },
    });
    const io = makeMockIo();
    continueBoard(io as any, TEST_SESSION_ID);
    expect(getSession(TEST_SESSION_ID)?.activeQuestion).toBeNull();
  });
});

describe('host:audioControl', () => {
  it('faz broadcast de audio:sync', () => {
    const socket = makeMockSocket('host-socket');
    const io = makeMockIo();
    // Simular socket.to().emit()
    const broadcastEmitted: unknown[] = [];
    socket.to = vi.fn(() => ({
      emit: vi.fn((...args: unknown[]) => broadcastEmitted.push(args)),
    })) as any;
    registerGameHandlers(io as any, socket as any);
    socket.trigger('host:audioControl', {
      sessionId: TEST_SESSION_ID,
      hostToken: HOST_TOKEN,
      action: 'play',
      currentTime: 0,
    });
    expect(broadcastEmitted.length).toBeGreaterThan(0);
  });
});
