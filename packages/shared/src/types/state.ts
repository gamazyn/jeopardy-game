import type { GameConfig } from './game.js';
import type { Player, FinalChallengeWager } from './player.js';
import type { Question } from './game.js';

export type GamePhase =
  | 'lobby'
  | 'board'
  | 'question'
  | 'buzzer_queue'
  | 'all_play'
  | 'double_wager'
  | 'answer_reveal'
  | 'final_challenge'
  | 'final_answer'
  | 'final_reveal'
  | 'game_over'
  | 'speed_round';

export interface ChallengeState {
  challengerId: string;
  challengerName: string;
  challengedId: string | null;
  challengedName: string | null;
}

export interface BuzzerEntry {
  playerId: string;
  playerName: string;
  timestamp: number;
  responded: boolean;
}

export interface SpeedRoundCorrect {
  playerId: string;
  playerName: string;
  scoreChange: number;
  rank: number; // 1, 2, 3
  timestamp: number;
}

export interface ActiveQuestion {
  categoryId: string;
  questionId: string;
  question: Question;
  startedAt: number;
  timerDuration: number;
  timerPausedAt?: number;
  timerRemainingMs?: number;
  lockedPlayerIds?: string[];       // all_play: players bloqueados por erro
  speedRoundCorrect?: SpeedRoundCorrect[]; // speed_round: quem acertou em ordem
}

export interface GameSession {
  sessionId: string;
  hostId: string;
  hostToken: string;
  gameConfig: GameConfig;
  players: Record<string, Player>;
  phase: GamePhase;
  activeQuestion: ActiveQuestion | null;
  buzzerQueue: BuzzerEntry[];
  finalChallengeWagers: Record<string, FinalChallengeWager>;
  // Double (Dupla Aposta)
  doublePlayerId: string | null;
  doubleWager: number | null;
  // Challenge
  challengeState: ChallengeState | null;
  startedAt?: number;
  endedAt?: number;
}
