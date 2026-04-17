import { create } from 'zustand';
import type {
  GameConfig,
  Player,
  GamePhase,
  ActiveQuestion,
  BuzzerEntry,
  ChallengeState,
} from '@jeopardy/shared';

interface TimerState {
  remainingMs: number;
  totalMs: number;
  isPaused: boolean;
}

interface HostWager {
  playerId: string;
  playerName: string;
  amount: number;
  answer: string;
}

interface WagerStatus {
  playerId: string;
  playerName: string;
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

  // Desafio Final — compartilhado
  finalClue: string | null;
  finalMedia: GameConfig['finalChallengeMedia'] | null;
  myWagerSent: boolean;
  wagersSubmitted: WagerStatus[];           // quem já apostou (todos veem)

  // Desafio Final — somente host
  finalCorrectAnswer: string | null;
  hostWagers: Record<string, HostWager>;    // detalhes das apostas (só host recebe)
  revealedWagers: Record<string, boolean>;  // quais jogadores já foram revelados

  // Dupla Aposta
  doublePlayerId: string | null;
  doublePlayerName: string | null;
  doubleWager: number | null;

  // Challenge
  challengeState: ChallengeState | null;

  // Ações
  setSession: (sessionId: string, hostToken: string | null, tunnelUrl: string | null, isHost: boolean) => void;
  setGameStarted: (config: Omit<GameConfig, 'finalChallengeAnswer'>, players: Player[]) => void;
  setPhase: (phase: GamePhase) => void;
  setPlayers: (players: Player[]) => void;
  setActiveQuestion: (q: ActiveQuestion | null) => void;
  setBuzzerQueue: (queue: BuzzerEntry[]) => void;
  setTimer: (timer: TimerState | null) => void;
  markQuestionUsed: (categoryId: string, questionId: string) => void;
  setFinalChallenge: (clue: string, media?: GameConfig['finalChallengeMedia']) => void;
  setFinalCorrectAnswer: (answer: string) => void;
  addWagerSubmitted: (playerId: string, playerName: string) => void;
  addHostWager: (wager: HostWager) => void;
  markWagerRevealed: (playerId: string) => void;
  setMyWagerSent: () => void;
  setDoubleAssigned: (playerId: string | null, playerName: string | null) => void;
  setDoubleWagerLocked: (wager: number) => void;
  setChallengeState: (state: ChallengeState | null) => void;
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
  myWagerSent: false,
  wagersSubmitted: [],
  finalCorrectAnswer: null,
  hostWagers: {},
  revealedWagers: {},
  doublePlayerId: null,
  doublePlayerName: null,
  doubleWager: null,
  challengeState: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setSession: (sessionId, hostToken, tunnelUrl, isHost) =>
    set({ sessionId, hostToken, tunnelUrl, isHost }),

  setGameStarted: (config, players) =>
    set({ gameConfig: config, players, phase: 'board' }),

  setPhase: (phase) => set({ phase }),

  setPlayers: (players) => set({ players }),

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

  setFinalChallenge: (finalClue, finalMedia) =>
    set({ finalClue, finalMedia, phase: 'final_challenge' }),

  setFinalCorrectAnswer: (finalCorrectAnswer) => set({ finalCorrectAnswer }),

  addWagerSubmitted: (playerId, playerName) =>
    set((s) => ({
      wagersSubmitted: s.wagersSubmitted.some((w) => w.playerId === playerId)
        ? s.wagersSubmitted
        : [...s.wagersSubmitted, { playerId, playerName }],
    })),

  addHostWager: (wager) =>
    set((s) => ({ hostWagers: { ...s.hostWagers, [wager.playerId]: wager } })),

  markWagerRevealed: (playerId) =>
    set((s) => ({ revealedWagers: { ...s.revealedWagers, [playerId]: true } })),

  setMyWagerSent: () => set({ myWagerSent: true }),

  setDoubleAssigned: (doublePlayerId, doublePlayerName) =>
    set({ doublePlayerId, doublePlayerName }),

  setDoubleWagerLocked: (doubleWager) => set({ doubleWager }),

  setChallengeState: (challengeState) => set({ challengeState }),

  reset: () => set(initialState),
}));
