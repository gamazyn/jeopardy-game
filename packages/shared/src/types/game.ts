export type QuestionType = 'standard' | 'all_play' | 'challenge' | 'double' | 'speed_round';

export interface MediaAsset {
  type: 'image' | 'audio';
  filename: string;
  altText?: string;
}

export interface Question {
  id: string;
  value: number;
  clue: string;
  answer: string;
  type: QuestionType;
  media?: MediaAsset;      // imagem do clue
  clueAudio?: MediaAsset;  // áudio do clue
  answerMedia?: MediaAsset; // imagem da resposta
  answerAudio?: MediaAsset; // áudio da resposta
  used: boolean;
  challengeTarget?: string;
  timeOverride?: number;
}

export interface Category {
  id: string;
  name: string;
  media?: MediaAsset;
  questions: Question[];
}

export interface GameConfig {
  id: string;
  version: number;
  name: string;
  description?: string;
  categories: Category[];
  defaultTimer: number;
  finalChallengeEnabled: boolean;
  finalChallengeClue: string;
  finalChallengeAnswer: string;
  finalChallengeMedia?: MediaAsset;
  finalChallengeWagerSeconds?: number;   // default 60
  finalChallengeAnswerSeconds?: number;  // default 60
  createdAt: string;
  updatedAt: string;
}
