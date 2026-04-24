import { Router, type IRouter } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { saveGame, loadGame, listGames, deleteGame } from '../storage/fileStorage.js';
import type { GameConfig } from '@responde-ai/shared';

export const gameRouter: IRouter = Router();

const MediaAssetSchema = z.object({ type: z.enum(['image', 'audio']), filename: z.string(), altText: z.string().optional() });

const QuestionSchema = z.object({
  id: z.string().min(1),
  value: z.number().int().positive(),
  clue: z.string().min(1).max(2000),
  answer: z.string().min(1).max(500),
  type: z.enum(['standard', 'all_play', 'challenge', 'double']),
  media: MediaAssetSchema.optional(),
  clueAudio: MediaAssetSchema.optional(),
  answerMedia: MediaAssetSchema.optional(),
  answerAudio: MediaAssetSchema.optional(),
  used: z.boolean(),
  challengeTarget: z.string().optional(),
  timeOverride: z.number().int().positive().optional(),
});

const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  media: MediaAssetSchema.optional(),
  questions: z.array(QuestionSchema).min(1).max(10),
});

const GameConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  categories: z.array(CategorySchema).min(1).max(10),
  defaultTimer: z.number().int().min(10).max(300),
  finalChallengeEnabled: z.boolean(),
  finalChallengeClue: z.string().max(2000),
  finalChallengeAnswer: z.string().max(500),
  finalChallengeMedia: MediaAssetSchema.optional(),
});

// GET /api/games — listar jogos
gameRouter.get('/', async (_req, res) => {
  const games = await listGames();
  res.json(games);
});

// GET /api/games/:id — carregar jogo
gameRouter.get('/:id', async (req, res) => {
  const game = await loadGame(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Jogo não encontrado' });
    return;
  }
  res.json(game);
});

// POST /api/games — criar jogo
gameRouter.post('/', async (req, res) => {
  const parsed = GameConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }

  const now = new Date().toISOString();
  const config: GameConfig = {
    ...parsed.data,
    id: randomUUID(),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await saveGame(config);
  res.status(201).json(config);
});

// PUT /api/games/:id — atualizar jogo
gameRouter.put('/:id', async (req, res) => {
  const existing = await loadGame(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Jogo não encontrado' });
    return;
  }

  const parsed = GameConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }

  const updated: GameConfig = {
    ...parsed.data,
    id: existing.id,
    version: existing.version,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await saveGame(updated);
  res.json(updated);
});

// DELETE /api/games/:id — deletar jogo
gameRouter.delete('/:id', async (req, res) => {
  const ok = await deleteGame(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Jogo não encontrado' });
    return;
  }
  res.status(204).send();
});
