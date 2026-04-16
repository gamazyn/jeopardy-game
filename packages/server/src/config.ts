import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 3000);
export const CLIENT_URL = process.env.CLIENT_URL ?? `http://localhost:5173`;
export const DATA_DIR = resolve(__dirname, '../../..', 'data');
export const GAMES_DIR = resolve(DATA_DIR, 'games');

// Secret gerado em runtime — não persiste entre reinicializações (intencional para MVP)
export const RUNTIME_SECRET = process.env.SECRET_KEY ?? randomBytes(32).toString('hex');

export const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas
export const HOST_GRACE_PERIOD_MS = 30 * 1000;     // 30 segundos
export const MAX_PLAYERS = 10;
export const DEFAULT_TIMER_MS = 60_000;
