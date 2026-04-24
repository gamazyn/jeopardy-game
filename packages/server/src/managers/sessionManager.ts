import type { GameSession, GamePhase } from '@responde-ai/shared';
import { SESSION_TTL_MS } from '../config.js';

const sessions = new Map<string, GameSession>();

export function createSession(session: GameSession): void {
  sessions.set(session.sessionId, session);
}

export function getSession(sessionId: string): GameSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, update: Partial<GameSession>): GameSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const updated = { ...session, ...update };
  sessions.set(sessionId, updated);
  return updated;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionByHostId(hostId: string): GameSession | undefined {
  for (const session of sessions.values()) {
    if (session.hostId === hostId) return session;
  }
}

export function getSessionByPlayerId(playerId: string): GameSession | undefined {
  for (const session of sessions.values()) {
    if (session.players[playerId]) return session;
  }
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    const isExpired = now - (session.startedAt ?? now) > SESSION_TTL_MS;
    const isOverAndOld =
      session.phase === 'game_over' &&
      session.endedAt != null &&
      now - session.endedAt > 60_000;
    if (isExpired || isOverAndOld) {
      sessions.delete(id);
    }
  }
}

// Inicia limpeza periódica
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
