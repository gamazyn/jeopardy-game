import { Router, Request, type IRouter } from 'express';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';
import { unlink } from 'fs/promises';
import multer from 'multer';
import { loadGame, getMediaDir } from '../storage/fileStorage.js';
import { MEDIA_MAX_MB } from '../config.js';

export const mediaRouter: IRouter = Router({ mergeParams: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/webm',
]);
const MAX_SIZE = MEDIA_MAX_MB * 1024 * 1024;

type GameMediaRequest = Request<{ gameId: string }>;

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      const gameId = (req as GameMediaRequest).params.gameId;
      const dir = await getMediaDir(gameId);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF, WebP ou áudio (MP3, OGG, WAV, AAC).'));
    }
  },
  limits: { fileSize: MAX_SIZE },
});

// DELETE /api/games/:gameId/media/:filename
mediaRouter.delete('/:filename', async (req: Request<{ gameId: string; filename: string }>, res) => {
  const { gameId, filename } = req.params;

  if (!/^[a-f0-9-]+\.[a-z]+$/i.test(filename)) {
    res.status(400).json({ error: 'Nome de arquivo inválido' });
    return;
  }

  const game = await loadGame(gameId);
  if (!game) {
    res.status(404).json({ error: 'Jogo não encontrado' });
    return;
  }

  try {
    const dir = await getMediaDir(gameId);
    await unlink(resolve(dir, filename));
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// POST /api/games/:gameId/media
mediaRouter.post('/', async (req: GameMediaRequest, res) => {
  const game = await loadGame(req.params.gameId);
  if (!game) {
    res.status(404).json({ error: 'Jogo não encontrado' });
    return;
  }

  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Arquivo não enviado' });
      return;
    }
    const mediaType = req.file.mimetype.startsWith('audio/') ? 'audio' : 'image';
    res.status(201).json({
      filename: req.file.filename,
      type: mediaType,
      url: `/media/${req.params.gameId}/${req.file.filename}`,
    });
  });
});
