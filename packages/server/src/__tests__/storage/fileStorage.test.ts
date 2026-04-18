import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { GameConfig } from '@jeopardy/shared';

// Override GAMES_DIR com diretório temporário
let tmpDir: string;
let GAMES_DIR: string;

vi.mock('../../config.js', async () => {
  return {
    get GAMES_DIR() {
      return GAMES_DIR;
    },
    SESSION_TTL_MS: 4 * 60 * 60 * 1000,
  };
});

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'jeopardy-test-'));
  GAMES_DIR = tmpDir;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeConfig(id = 'game-1'): GameConfig {
  return {
    id,
    name: 'Test Game',
    description: 'Desc',
    categories: [],
    defaultTimer: 60,
    finalChallengeEnabled: false,
    finalChallengeClue: '',
    finalChallengeAnswer: '',
    version: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

describe('saveGame / loadGame', () => {
  it('salva e carrega jogo corretamente', async () => {
    const { saveGame, loadGame } = await import('../../storage/fileStorage.js');
    const config = makeConfig();
    await saveGame(config);
    const loaded = await loadGame('game-1');
    expect(loaded).toEqual(config);
  });

  it('retorna null para jogo inexistente', async () => {
    const { loadGame } = await import('../../storage/fileStorage.js');
    const result = await loadGame('nonexistent');
    expect(result).toBeNull();
  });

  it('sobrescreve jogo existente', async () => {
    const { saveGame, loadGame } = await import('../../storage/fileStorage.js');
    await saveGame(makeConfig());
    const updated = { ...makeConfig(), name: 'Updated' };
    await saveGame(updated);
    const loaded = await loadGame('game-1');
    expect(loaded?.name).toBe('Updated');
  });
});

describe('listGames', () => {
  it('lista jogos salvos', async () => {
    const { saveGame, listGames } = await import('../../storage/fileStorage.js');
    await saveGame(makeConfig('g1'));
    await saveGame(makeConfig('g2'));
    const list = await listGames();
    expect(list.length).toBe(2);
    const ids = list.map((g) => g.id);
    expect(ids).toContain('g1');
    expect(ids).toContain('g2');
  });

  it('retorna array vazio quando não há jogos', async () => {
    const { listGames } = await import('../../storage/fileStorage.js');
    const list = await listGames();
    expect(list).toEqual([]);
  });

  it('retorna apenas campos de metadados', async () => {
    const { saveGame, listGames } = await import('../../storage/fileStorage.js');
    await saveGame(makeConfig('meta-game'));
    const list = await listGames();
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('name');
    expect(list[0]).not.toHaveProperty('categories');
  });
});

describe('deleteGame', () => {
  it('deleta jogo existente e retorna true', async () => {
    const { saveGame, deleteGame, loadGame } = await import('../../storage/fileStorage.js');
    await saveGame(makeConfig('del-game'));
    const result = await deleteGame('del-game');
    expect(result).toBe(true);
    expect(await loadGame('del-game')).toBeNull();
  });

  it('retorna true para jogo inexistente (force=true)', async () => {
    const { deleteGame } = await import('../../storage/fileStorage.js');
    const result = await deleteGame('nonexistent');
    expect(result).toBe(true);
  });
});
