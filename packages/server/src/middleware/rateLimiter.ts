import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Rate limiter por evento de socket
const socketEventCounts = new Map<string, { count: number; resetAt: number }>();

export function socketRateLimit(socketId: string, event: string, maxPerSecond: number): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const entry = socketEventCounts.get(key);

  if (!entry || now > entry.resetAt) {
    socketEventCounts.set(key, { count: 1, resetAt: now + 1000 });
    return true;
  }

  if (entry.count >= maxPerSecond) return false;
  entry.count++;
  return true;
}

// Limpeza periódica do mapa de rate limit de socket
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of socketEventCounts.entries()) {
    if (now > entry.resetAt + 5000) socketEventCounts.delete(key);
  }
}, 60_000);
