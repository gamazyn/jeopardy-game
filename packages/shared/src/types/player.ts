export type PlayerRole = 'host' | 'player' | 'spectator';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  score: number;
  isConnected: boolean;
  joinedAt: number;
  avatarColor: string;
}

export interface FinalChallengeWager {
  playerId: string;
  amount: number;
  answer?: string;
  isCorrect?: boolean;
  revealed: boolean;
}
