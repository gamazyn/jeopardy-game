import { Router, Request, type IRouter } from 'express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import multer from 'multer';
import { loadGame, getMediaDir } from '../storage/fileStorage.js';

export const mediaRouter: IRouter = Router({ mergeParams: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

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
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.'));
    }
  },
  limits: { fileSize: MAX_SIZE },
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
    res.status(201).json({
      filename: req.file.filename,
      url: `/media/${req.params.gameId}/${req.file.filename}`,
    });
  });
});
