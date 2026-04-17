import type { GamePhase } from '@jeopardy/shared';

// Transições válidas da state machine
const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  lobby:            ['board'],
  board:            ['question', 'all_play', 'double_wager', 'final_challenge', 'game_over'],
  question:         ['buzzer_queue', 'answer_reveal', 'board'],
  buzzer_queue:     ['buzzer_queue', 'answer_reveal', 'board'],
  all_play:         ['buzzer_queue', 'answer_reveal', 'board'],
  double_wager:     ['question'],
  answer_reveal:    ['board', 'final_challenge'],
  final_challenge:  ['final_reveal'],
  final_reveal:     ['game_over'],
  game_over:        [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isHostAction(phase: GamePhase, action: string): boolean {
  const hostOnlyPhases: GamePhase[] = ['board', 'question', 'buzzer_queue', 'all_play', 'final_reveal'];
  return hostOnlyPhases.includes(phase);
}

export function allQuestionsUsed(categories: { questions: { used: boolean }[] }[]): boolean {
  return categories.every((cat) => cat.questions.every((q) => q.used));
}
