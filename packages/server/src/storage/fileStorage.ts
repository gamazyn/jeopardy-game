import { readFile, writeFile, mkdir, readdir, rm, stat } from 'fs/promises';
import { resolve } from 'path';
import { GAMES_DIR } from '../config.js';
import type { GameConfig } from '@responde-ai/shared';

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function saveGame(config: GameConfig): Promise<void> {
  const gameDir = resolve(GAMES_DIR, config.id);
  await ensureDir(gameDir);
  await ensureDir(resolve(gameDir, 'media'));
  await writeFile(resolve(gameDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

export async function loadGame(gameId: string): Promise<GameConfig | null> {
  try {
    const raw = await readFile(resolve(GAMES_DIR, gameId, 'config.json'), 'utf-8');
    return JSON.parse(raw) as GameConfig;
  } catch {
    return null;
  }
}

export async function listGames(): Promise<Pick<GameConfig, 'id' | 'name' | 'description' | 'updatedAt' | 'createdAt'>[]> {
  try {
    await ensureDir(GAMES_DIR);
    const entries = await readdir(GAMES_DIR, { withFileTypes: true });
    const games = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const config = await loadGame(e.name);
          if (!config) return null;
          return {
            id: config.id,
            name: config.name,
            description: config.description,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          };
        }),
    );
    return games.filter(Boolean) as Pick<GameConfig, 'id' | 'name' | 'description' | 'updatedAt' | 'createdAt'>[];
  } catch {
    return [];
  }
}

export async function deleteGame(gameId: string): Promise<boolean> {
  try {
    const gameDir = resolve(GAMES_DIR, gameId);
    await rm(gameDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function getMediaDir(gameId: string): Promise<string> {
  const dir = resolve(GAMES_DIR, gameId, 'media');
  await ensureDir(dir);
  return dir;
}
