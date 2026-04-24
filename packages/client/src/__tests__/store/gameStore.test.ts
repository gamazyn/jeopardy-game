import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../store/gameStore.js';
import type { GameConfig, Player, ActiveQuestion } from '@responde-ai/shared';

function makeConfig(): Omit<GameConfig, 'finalChallengeAnswer'> {
  return {
    id: 'g1',
    name: 'Test',
    description: '',
    categories: [
      {
        id: 'cat-1',
        name: 'Cat',
        questions: [
          { id: 'q1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
          { id: 'q2', value: 200, clue: 'Q2', answer: 'A2', type: 'standard', used: false },
        ],
      },
    ],
    defaultTimer: 60,
    finalChallengeEnabled: false,
    finalChallengeClue: '',
    version: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

function makePlayers(): Player[] {
  return [
    { id: 'p1', name: 'Alice', role: 'player', score: 0, isConnected: true, joinedAt: 0, avatarColor: '#f00' },
    { id: 'p2', name: 'Bob', role: 'player', score: 100, isConnected: true, joinedAt: 0, avatarColor: '#00f' },
  ];
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('setSession', () => {
  it('configura dados da sessão', () => {
    useGameStore.getState().setSession('sess-1', 'token-x', 'http://tunnel', 'http://local', true);
    const state = useGameStore.getState();
    expect(state.sessionId).toBe('sess-1');
    expect(state.hostToken).toBe('token-x');
    expect(state.tunnelUrl).toBe('http://tunnel');
    expect(state.localUrl).toBe('http://local');
    expect(state.isHost).toBe(true);
  });

  it('funciona para sessão de player (isHost=false)', () => {
    useGameStore.getState().setSession('sess-2', null, null, null, false);
    expect(useGameStore.getState().isHost).toBe(false);
    expect(useGameStore.getState().hostToken).toBeNull();
  });
});

describe('setGameStarted', () => {
  it('configura gameConfig, players e fase board', () => {
    const config = makeConfig();
    const players = makePlayers();
    useGameStore.getState().setGameStarted(config, players);
    const state = useGameStore.getState();
    expect(state.gameConfig).toEqual(config);
    expect(state.players).toEqual(players);
    expect(state.phase).toBe('board');
  });
});

describe('setPhase', () => {
  it('atualiza a fase do jogo', () => {
    useGameStore.getState().setPhase('question');
    expect(useGameStore.getState().phase).toBe('question');
  });
});

describe('setPlayers', () => {
  it('atualiza lista de players', () => {
    const players = makePlayers();
    useGameStore.getState().setPlayers(players);
    expect(useGameStore.getState().players).toHaveLength(2);
  });
});

describe('setActiveQuestion', () => {
  it('configura questão ativa', () => {
    const q: ActiveQuestion = {
      categoryId: 'cat-1',
      questionId: 'q1',
      question: { id: 'q1', value: 100, clue: 'Q', answer: 'A', type: 'standard', used: false },
      startedAt: Date.now(),
      timerDuration: 30000,
    };
    useGameStore.getState().setActiveQuestion(q);
    expect(useGameStore.getState().activeQuestion).toEqual(q);
  });

  it('aceita null', () => {
    useGameStore.getState().setActiveQuestion(null);
    expect(useGameStore.getState().activeQuestion).toBeNull();
  });
});

describe('setBuzzerQueue', () => {
  it('atualiza a fila do buzzer', () => {
    useGameStore.getState().setBuzzerQueue([
      { playerId: 'p1', playerName: 'Alice', timestamp: 1, responded: false },
    ]);
    expect(useGameStore.getState().buzzerQueue).toHaveLength(1);
  });
});

describe('setTimer', () => {
  it('configura estado do timer', () => {
    useGameStore.getState().setTimer({ remainingMs: 30000, totalMs: 60000, isPaused: false });
    expect(useGameStore.getState().timer?.remainingMs).toBe(30000);
  });

  it('aceita null para limpar timer', () => {
    useGameStore.getState().setTimer(null);
    expect(useGameStore.getState().timer).toBeNull();
  });
});

describe('markQuestionUsed', () => {
  it('marca questão como usada', () => {
    useGameStore.getState().setGameStarted(makeConfig(), []);
    useGameStore.getState().markQuestionUsed('cat-1', 'q1');
    const cat = useGameStore.getState().gameConfig?.categories[0];
    expect(cat?.questions.find((q) => q.id === 'q1')?.used).toBe(true);
  });

  it('não altera outras questões', () => {
    useGameStore.getState().setGameStarted(makeConfig(), []);
    useGameStore.getState().markQuestionUsed('cat-1', 'q1');
    const cat = useGameStore.getState().gameConfig?.categories[0];
    expect(cat?.questions.find((q) => q.id === 'q2')?.used).toBe(false);
  });

  it('não faz nada sem gameConfig', () => {
    expect(() => useGameStore.getState().markQuestionUsed('cat-1', 'q1')).not.toThrow();
  });
});

describe('setFinalChallenge', () => {
  it('configura clue, media e transita para final_challenge', () => {
    useGameStore.getState().setFinalChallenge('Clue final', undefined);
    const state = useGameStore.getState();
    expect(state.finalClue).toBe('Clue final');
    expect(state.phase).toBe('final_challenge');
    expect(state.finalMedia).toBeUndefined();
  });
});

describe('setFinalCorrectAnswer', () => {
  it('configura resposta correta', () => {
    useGameStore.getState().setFinalCorrectAnswer('Resposta certa');
    expect(useGameStore.getState().finalCorrectAnswer).toBe('Resposta certa');
  });
});

describe('addWagerSubmitted', () => {
  it('adiciona wager ao array', () => {
    useGameStore.getState().addWagerSubmitted('p1', 'Alice');
    expect(useGameStore.getState().wagersSubmitted).toHaveLength(1);
  });

  it('não duplica wager do mesmo jogador', () => {
    useGameStore.getState().addWagerSubmitted('p1', 'Alice');
    useGameStore.getState().addWagerSubmitted('p1', 'Alice');
    expect(useGameStore.getState().wagersSubmitted).toHaveLength(1);
  });

  it('permite wagers de jogadores diferentes', () => {
    useGameStore.getState().addWagerSubmitted('p1', 'Alice');
    useGameStore.getState().addWagerSubmitted('p2', 'Bob');
    expect(useGameStore.getState().wagersSubmitted).toHaveLength(2);
  });
});

describe('addHostWager', () => {
  it('adiciona detalhes da aposta para o host', () => {
    useGameStore.getState().addHostWager({ playerId: 'p1', playerName: 'Alice', amount: 300, answer: 'answer' });
    expect(useGameStore.getState().hostWagers['p1']?.amount).toBe(300);
  });
});

describe('markWagerRevealed', () => {
  it('marca jogador como revelado', () => {
    useGameStore.getState().markWagerRevealed('p1');
    expect(useGameStore.getState().revealedWagers['p1']).toBe(true);
  });
});

describe('setMyWagerSent', () => {
  it('marca que minha aposta foi enviada', () => {
    useGameStore.getState().setMyWagerSent();
    expect(useGameStore.getState().myWagerSent).toBe(true);
  });
});

describe('setDoubleAssigned', () => {
  it('configura jogador da dupla aposta', () => {
    useGameStore.getState().setDoubleAssigned('p1', 'Alice');
    const state = useGameStore.getState();
    expect(state.doublePlayerId).toBe('p1');
    expect(state.doublePlayerName).toBe('Alice');
  });

  it('aceita null para limpar', () => {
    useGameStore.getState().setDoubleAssigned(null, null);
    expect(useGameStore.getState().doublePlayerId).toBeNull();
  });
});

describe('setDoubleWagerLocked', () => {
  it('configura valor da aposta', () => {
    useGameStore.getState().setDoubleWagerLocked(250);
    expect(useGameStore.getState().doubleWager).toBe(250);
  });
});

describe('setChallengeState', () => {
  it('configura estado do desafio', () => {
    const cs = { challengerId: 'p1', challengerName: 'Alice', challengedId: 'p2', challengedName: 'Bob' };
    useGameStore.getState().setChallengeState(cs);
    expect(useGameStore.getState().challengeState).toEqual(cs);
  });

  it('aceita null para limpar', () => {
    useGameStore.getState().setChallengeState(null);
    expect(useGameStore.getState().challengeState).toBeNull();
  });
});

describe('reset', () => {
  it('restaura estado inicial', () => {
    useGameStore.getState().setSession('sess', 'tok', null, null, true);
    useGameStore.getState().setPhase('question');
    useGameStore.getState().reset();
    const state = useGameStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.phase).toBe('lobby');
    expect(state.players).toEqual([]);
    expect(state.isHost).toBe(false);
  });
});
