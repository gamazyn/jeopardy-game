import type { Server } from 'socket.io';

interface TimerState {
  intervalId: NodeJS.Timeout;
  startedAt: number;
  totalMs: number;
  remainingMsAtPause?: number;
  isPaused: boolean;
}

const timers = new Map<string, TimerState>();

export function startTimer(
  io: Server,
  sessionId: string,
  durationMs: number,
  onExpire: () => void,
): void {
  stopTimer(sessionId);

  const startedAt = Date.now();

  io.to(`session:${sessionId}`).emit('timer:update', {
    action: 'start',
    remainingMs: durationMs,
    totalMs: durationMs,
  });

  const intervalId = setInterval(() => {
    const state = timers.get(sessionId);
    if (!state || state.isPaused) return;

    const elapsed = Date.now() - state.startedAt;
    const remaining = Math.max(0, state.totalMs - elapsed);

    io.to(`session:${sessionId}`).emit('timer:update', {
      action: remaining > 0 ? 'tick' : 'expired',
      remainingMs: remaining,
      totalMs: state.totalMs,
    });

    if (remaining <= 0) {
      stopTimer(sessionId);
      onExpire();
    }
  }, 500);

  timers.set(sessionId, {
    intervalId,
    startedAt,
    totalMs: durationMs,
    isPaused: false,
  });
}

export function pauseTimer(io: Server, sessionId: string): number | null {
  const state = timers.get(sessionId);
  if (!state || state.isPaused) return null;

  const elapsed = Date.now() - state.startedAt;
  const remaining = Math.max(0, state.totalMs - elapsed);

  timers.set(sessionId, { ...state, isPaused: true, remainingMsAtPause: remaining });

  io.to(`session:${sessionId}`).emit('timer:update', {
    action: 'pause',
    remainingMs: remaining,
    totalMs: state.totalMs,
  });

  return remaining;
}

export function resumeTimer(
  io: Server,
  sessionId: string,
  onExpire: () => void,
): void {
  const state = timers.get(sessionId);
  if (!state || !state.isPaused || state.remainingMsAtPause == null) return;

  const remainingMs = state.remainingMsAtPause;
  stopTimer(sessionId);
  startTimer(io, sessionId, remainingMs, onExpire);

  io.to(`session:${sessionId}`).emit('timer:update', {
    action: 'resume',
    remainingMs,
    totalMs: state.totalMs,
  });
}

export function extendTimer(
  io: Server,
  sessionId: string,
  additionalMs: number,
  onExpire: () => void,
): void {
  const state = timers.get(sessionId);
  if (!state) return;

  const elapsed = state.isPaused ? 0 : Date.now() - state.startedAt;
  const currentRemaining = state.isPaused
    ? (state.remainingMsAtPause ?? 0)
    : Math.max(0, state.totalMs - elapsed);
  const newRemaining = currentRemaining + additionalMs;

  stopTimer(sessionId);
  startTimer(io, sessionId, newRemaining, onExpire);

  io.to(`session:${sessionId}`).emit('timer:update', {
    action: 'extend',
    remainingMs: newRemaining,
    totalMs: newRemaining,
  });
}

export function setTimer(
  io: Server,
  sessionId: string,
  durationMs: number,
  onExpire: () => void,
): void {
  stopTimer(sessionId);
  startTimer(io, sessionId, durationMs, onExpire);
}

export function stopTimer(sessionId: string): void {
  const state = timers.get(sessionId);
  if (state) {
    clearInterval(state.intervalId);
    timers.delete(sessionId);
  }
}
