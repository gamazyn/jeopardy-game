import type { GameSession, GameConfig, Player } from '@jeopardy/shared';
import { createSession, deleteSession } from '../../managers/sessionManager.js';

export const TEST_SESSION_ID = 'TEST01';
export const HOST_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export function makePlayer(id: string, name: string, score = 0): Player {
  return {
    id,
    name,
    role: 'player',
    score,
    isConnected: true,
    joinedAt: Date.now(),
    avatarColor: '#fff',
  };
}

export function makeGameConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    id: 'game-1',
    name: 'Test',
    description: '',
    categories: [
      {
        id: 'cat-1',
        name: 'Cat 1',
        questions: [
          { id: 'q-1', value: 100, clue: 'Q1', answer: 'A1', type: 'standard', used: false },
          { id: 'q-2', value: 200, clue: 'Q2', answer: 'A2', type: 'all_play', used: false },
          { id: 'q-3', value: 300, clue: 'Q3', answer: 'A3', type: 'double', used: false },
          { id: 'q-4', value: 400, clue: 'Q4', answer: 'A4', type: 'challenge', used: false },
          { id: 'q-used', value: 500, clue: 'Q5', answer: 'A5', type: 'standard', used: true },
        ],
      },
    ],
    defaultTimer: 30,
    finalChallengeEnabled: true,
    finalChallengeClue: 'Final clue',
    finalChallengeAnswer: 'Final answer',
    version: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

export function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    sessionId: TEST_SESSION_ID,
    hostId: 'host-socket',
    hostToken: HOST_TOKEN,
    gameConfig: makeGameConfig(),
    players: {
      'player-1': makePlayer('player-1', 'Alice', 500),
      'player-2': makePlayer('player-2', 'Bob', 300),
    },
    phase: 'board',
    activeQuestion: null,
    buzzerQueue: [],
    finalChallengeWagers: {},
    doublePlayerId: null,
    doubleWager: null,
    challengeState: null,
    ...overrides,
  };
}

export function setupSession(overrides: Partial<GameSession> = {}): GameSession {
  deleteSession(TEST_SESSION_ID);
  const session = makeSession(overrides);
  createSession(session);
  return session;
}
