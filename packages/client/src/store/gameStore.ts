import { create } from 'zustand';
import type {
  GameConfig,
  Player,
  GamePhase,
  ActiveQuestion,
  BuzzerEntry,
  FinalChallengeWager,
} from '@jeopardy/shared';

interface TimerState {
  remainingMs: number;
  totalMs: number;
  isPaused: boolean;
}

interface GameState {
  // Sessão
  sessionId: string | null;
  hostToken: string | null;
  tunnelUrl: string | null;
  isHost: boolean;

  // Jogo
  gameConfig: Omit<GameConfig, 'finalChallengeAnswer'> | null;
  players: Player[];
  phase: GamePhase;
  activeQuestion: ActiveQuestion | null;
  buzzerQueue: BuzzerEntry[];
  timer: TimerState | null;

  // Desafio Final
  finalClue: string | null;
  finalMedia: GameConfig['finalChallengeMedia'] | null;
  finalWagers: Record<string, FinalChallengeWager>;
  myWagerSent: boolean;

  // Ações
  setSession: (sessionId: string, hostToken: string | null, tunnelUrl: string | null, isHost: boolean) => void;
  setGameStarted: (config: Omit<GameConfig, 'finalChallengeAnswer'>, players: Player[]) => void;
  setPhase: (phase: GamePhase) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  setPlayerDisconnected: (playerId: string) => void;
  setActiveQuestion: (q: ActiveQuestion | null) => void;
  setBuzzerQueue: (queue: BuzzerEntry[]) => void;
  setTimer: (timer: TimerState | null) => void;
  markQuestionUsed: (categoryId: string, questionId: string) => void;
  setFinalChallenge: (clue: string, media?: GameConfig['finalChallengeMedia']) => void;
  setMyWagerSent: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  hostToken: null,
  tunnelUrl: null,
  isHost: false,
  gameConfig: null,
  players: [],
  phase: 'lobby' as GamePhase,
  activeQuestion: null,
  buzzerQueue: [],
  timer: null,
  finalClue: null,
  finalMedia: null,
  finalWagers: {},
  myWagerSent: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setSession: (sessionId, hostToken, tunnelUrl, isHost) =>
    set({ sessionId, hostToken, tunnelUrl, isHost }),

  setGameStarted: (config, players) =>
    set({ gameConfig: config, players, phase: 'board' }),

  setPhase: (phase) => set({ phase }),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((s) => ({ players: [...s.players.filter((p) => p.id !== player.id), player] })),

  setPlayerDisconnected: (playerId) =>
    set((s) => ({
      players: s.players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p)),
    })),

  setActiveQuestion: (activeQuestion) => set({ activeQuestion }),

  setBuzzerQueue: (buzzerQueue) => set({ buzzerQueue }),

  setTimer: (timer) => set({ timer }),

  markQuestionUsed: (categoryId, questionId) =>
    set((s) => {
      if (!s.gameConfig) return s;
      return {
        gameConfig: {
          ...s.gameConfig,
          categories: s.gameConfig.categories.map((cat) =>
            cat.id === categoryId
              ? {
                  ...cat,
                  questions: cat.questions.map((q) =>
                    q.id === questionId ? { ...q, used: true } : q,
                  ),
                }
              : cat,
          ),
        },
      };
    }),

  setFinalChallenge: (finalClue, finalMedia) => set({ finalClue, finalMedia, phase: 'final_challenge' }),

  setMyWagerSent: () => set({ myWagerSent: true }),

  reset: () => set(initialState),
}));
