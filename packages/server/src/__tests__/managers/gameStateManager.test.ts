import { describe, it, expect } from 'vitest';
import { canTransition, isHostAction, allQuestionsUsed } from '../../managers/gameStateManager.js';
import type { GamePhase } from '@responde-ai/shared';

describe('canTransition', () => {
  it('lobby → board é válido', () => {
    expect(canTransition('lobby', 'board')).toBe(true);
  });

  it('lobby → question é inválido', () => {
    expect(canTransition('lobby', 'question')).toBe(false);
  });

  it('board aceita todas as transições de questão', () => {
    expect(canTransition('board', 'question')).toBe(true);
    expect(canTransition('board', 'all_play')).toBe(true);
    expect(canTransition('board', 'double_wager')).toBe(true);
    expect(canTransition('board', 'final_challenge')).toBe(true);
    expect(canTransition('board', 'game_over')).toBe(true);
  });

  it('question → buzzer_queue, answer_reveal, board', () => {
    expect(canTransition('question', 'buzzer_queue')).toBe(true);
    expect(canTransition('question', 'answer_reveal')).toBe(true);
    expect(canTransition('question', 'board')).toBe(true);
  });

  it('question → lobby é inválido', () => {
    expect(canTransition('question', 'lobby')).toBe(false);
  });

  it('buzzer_queue → si mesmo é válido', () => {
    expect(canTransition('buzzer_queue', 'buzzer_queue')).toBe(true);
  });

  it('double_wager → apenas question', () => {
    expect(canTransition('double_wager', 'question')).toBe(true);
    expect(canTransition('double_wager', 'board')).toBe(false);
  });

  it('answer_reveal → board ou final_challenge', () => {
    expect(canTransition('answer_reveal', 'board')).toBe(true);
    expect(canTransition('answer_reveal', 'final_challenge')).toBe(true);
    expect(canTransition('answer_reveal', 'lobby')).toBe(false);
  });

  it('final_challenge → final_answer ou final_reveal', () => {
    expect(canTransition('final_challenge', 'final_answer')).toBe(true);
    expect(canTransition('final_challenge', 'final_reveal')).toBe(true);
    expect(canTransition('final_challenge', 'board')).toBe(false);
  });

  it('final_answer → final_reveal', () => {
    expect(canTransition('final_answer', 'final_reveal')).toBe(true);
    expect(canTransition('final_answer', 'board')).toBe(false);
  });

  it('final_reveal → game_over', () => {
    expect(canTransition('final_reveal', 'game_over')).toBe(true);
    expect(canTransition('final_reveal', 'board')).toBe(false);
  });

  it('game_over não tem transições válidas', () => {
    const phases: GamePhase[] = ['lobby', 'board', 'question', 'buzzer_queue', 'all_play', 'double_wager', 'answer_reveal', 'final_challenge', 'final_answer', 'final_reveal', 'game_over', 'speed_round'];
    for (const phase of phases) {
      expect(canTransition('game_over', phase)).toBe(false);
    }
  });

  it('board → speed_round', () => {
    expect(canTransition('board', 'speed_round')).toBe(true);
  });

  it('speed_round → answer_reveal e board', () => {
    expect(canTransition('speed_round', 'answer_reveal')).toBe(true);
    expect(canTransition('speed_round', 'board')).toBe(true);
    expect(canTransition('speed_round', 'question')).toBe(false);
  });

  it('all_play → all_play (reabertura após bloqueio parcial)', () => {
    expect(canTransition('all_play', 'all_play')).toBe(true);
  });
});

describe('isHostAction', () => {
  it('retorna true para fases de ação do host', () => {
    expect(isHostAction('board', 'selectQuestion')).toBe(true);
    expect(isHostAction('question', 'clearQuestion')).toBe(true);
    expect(isHostAction('buzzer_queue', 'judge')).toBe(true);
    expect(isHostAction('all_play', 'clearQuestion')).toBe(true);
    expect(isHostAction('final_reveal', 'revealFinal')).toBe(true);
  });

  it('retorna false para fases sem ação exclusiva do host', () => {
    expect(isHostAction('lobby', 'create')).toBe(false);
    expect(isHostAction('double_wager', 'wager')).toBe(false);
    expect(isHostAction('answer_reveal', 'continue')).toBe(false);
    expect(isHostAction('final_challenge', 'wager')).toBe(false);
    expect(isHostAction('game_over', 'end')).toBe(false);
  });
});

describe('allQuestionsUsed', () => {
  it('retorna true quando todas as questões estão usadas', () => {
    const categories = [
      { questions: [{ used: true }, { used: true }] },
      { questions: [{ used: true }] },
    ];
    expect(allQuestionsUsed(categories)).toBe(true);
  });

  it('retorna false quando alguma questão não está usada', () => {
    const categories = [
      { questions: [{ used: true }, { used: false }] },
      { questions: [{ used: true }] },
    ];
    expect(allQuestionsUsed(categories)).toBe(false);
  });

  it('retorna true para array vazio de categorias', () => {
    expect(allQuestionsUsed([])).toBe(true);
  });

  it('retorna true para categoria com array vazio de questões', () => {
    expect(allQuestionsUsed([{ questions: [] }])).toBe(true);
  });

  it('retorna false se qualquer questão em qualquer categoria não está usada', () => {
    const categories = [
      { questions: [{ used: true }] },
      { questions: [{ used: true }] },
      { questions: [{ used: false }] },
    ];
    expect(allQuestionsUsed(categories)).toBe(false);
  });
});
