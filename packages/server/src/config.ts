import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 3000);
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
export const DATA_DIR = process.env.DATA_DIR ?? resolve(__dirname, '../../..', 'data');
export const GAMES_DIR = resolve(DATA_DIR, 'games');

export const RUNTIME_SECRET = process.env.SECRET_KEY ?? randomBytes(32).toString('hex');

export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 4) * 60 * 60 * 1000;
export const HOST_GRACE_PERIOD_MS = Number(process.env.HOST_GRACE_PERIOD_SECONDS ?? 30) * 1000;
export const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 10);
export const DEFAULT_TIMER_MS = Number(process.env.DEFAULT_TIMER_SECONDS ?? 60) * 1000;
export const MEDIA_MAX_MB = Number(process.env.MEDIA_MAX_MB ?? 10);
