import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { RUNTIME_SECRET } from '../config.js';

export function generateHostToken(sessionId: string): string {
  const rawToken = `${sessionId}:${Date.now()}:${randomUUID()}`;
  return createHmac('sha256', RUNTIME_SECRET).update(rawToken).digest('hex');
}

export function validateHostToken(storedToken: string, providedToken: string): boolean {
  if (!providedToken || storedToken.length !== providedToken.length) return false;
  try {
    return timingSafeEqual(Buffer.from(storedToken), Buffer.from(providedToken));
  } catch {
    return false;
  }
}
