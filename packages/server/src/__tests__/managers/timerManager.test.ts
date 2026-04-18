import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startTimer, stopTimer, pauseTimer, resumeTimer, extendTimer, setTimer } from '../../managers/timerManager.js';

// Mock socket.io Server
function makeIo() {
  const emitted: { event: string; data: unknown }[] = [];
  return {
    to: () => ({
      emit: (event: string, data: unknown) => {
        emitted.push({ event, data });
      },
    }),
    _emitted: emitted,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  stopTimer('test-session');
});

afterEach(() => {
  stopTimer('test-session');
  vi.useRealTimers();
});

describe('startTimer', () => {
  it('emite timer:update com action=start imediatamente', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    expect(io._emitted[0]).toMatchObject({
      event: 'timer:update',
      data: { action: 'start', remainingMs: 5000, totalMs: 5000 },
    });
  });

  it('emite tick a cada 500ms', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    const initialCount = io._emitted.length;
    vi.advanceTimersByTime(500);
    expect(io._emitted.length).toBeGreaterThan(initialCount);
    expect(io._emitted[io._emitted.length - 1].event).toBe('timer:update');
  });

  it('chama onExpire quando tempo esgota', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 1000, onExpire);
    vi.advanceTimersByTime(1500);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('para timer anterior ao iniciar novo', () => {
    const onExpire1 = vi.fn();
    const onExpire2 = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 2000, onExpire1);
    startTimer(io as any, 'test-session', 1000, onExpire2);
    vi.advanceTimersByTime(2500);
    expect(onExpire1).not.toHaveBeenCalled();
    expect(onExpire2).toHaveBeenCalledOnce();
  });

  it('emite expired quando tempo chega a 0', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 500, vi.fn());
    vi.advanceTimersByTime(600);
    const expired = io._emitted.find((e) => (e.data as any)?.action === 'expired');
    expect(expired).toBeDefined();
  });
});

describe('stopTimer', () => {
  it('para o timer sem erros', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    expect(() => stopTimer('test-session')).not.toThrow();
  });

  it('não chama onExpire após stop', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 1000, onExpire);
    stopTimer('test-session');
    vi.advanceTimersByTime(2000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('não lança erro para sessão sem timer', () => {
    expect(() => stopTimer('nonexistent')).not.toThrow();
  });
});

describe('pauseTimer', () => {
  it('retorna remainingMs ao pausar', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    vi.advanceTimersByTime(1000);
    const remaining = pauseTimer(io as any, 'test-session');
    expect(remaining).toBeLessThanOrEqual(5000);
    expect(remaining).toBeGreaterThan(0);
  });

  it('emite action=pause', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    pauseTimer(io as any, 'test-session');
    const pause = io._emitted.find((e) => (e.data as any)?.action === 'pause');
    expect(pause).toBeDefined();
  });

  it('retorna null se timer não existe', () => {
    const io = makeIo();
    expect(pauseTimer(io as any, 'ghost-session')).toBeNull();
  });

  it('retorna null se timer já pausado', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    pauseTimer(io as any, 'test-session');
    expect(pauseTimer(io as any, 'test-session')).toBeNull();
  });

  it('não avança o timer quando pausado', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 1000, onExpire);
    pauseTimer(io as any, 'test-session');
    vi.advanceTimersByTime(2000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe('resumeTimer', () => {
  it('emite action=resume', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    pauseTimer(io as any, 'test-session');
    const countBefore = io._emitted.length;
    resumeTimer(io as any, 'test-session', vi.fn());
    const resume = io._emitted.slice(countBefore).find((e) => (e.data as any)?.action === 'resume');
    expect(resume).toBeDefined();
  });

  it('chama onExpire após resumir com tempo restante', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 2000, vi.fn());
    pauseTimer(io as any, 'test-session');
    resumeTimer(io as any, 'test-session', onExpire);
    vi.advanceTimersByTime(3000);
    expect(onExpire).toHaveBeenCalled();
  });

  it('não faz nada se timer não existe', () => {
    const io = makeIo();
    expect(() => resumeTimer(io as any, 'ghost', vi.fn())).not.toThrow();
  });
});

describe('extendTimer', () => {
  it('adiciona tempo ao timer em andamento', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 1000, vi.fn());
    extendTimer(io as any, 'test-session', 5000, onExpire);
    vi.advanceTimersByTime(2000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4500);
    expect(onExpire).toHaveBeenCalled();
  });

  it('emite action=extend', () => {
    const io = makeIo();
    startTimer(io as any, 'test-session', 5000, vi.fn());
    extendTimer(io as any, 'test-session', 2000, vi.fn());
    const extend = io._emitted.find((e) => (e.data as any)?.action === 'extend');
    expect(extend).toBeDefined();
  });

  it('não faz nada se timer não existe', () => {
    const io = makeIo();
    expect(() => extendTimer(io as any, 'ghost', 1000, vi.fn())).not.toThrow();
  });
});

describe('setTimer', () => {
  it('substitui o timer com nova duração', () => {
    const onExpire = vi.fn();
    const io = makeIo();
    startTimer(io as any, 'test-session', 500, vi.fn());
    setTimer(io as any, 'test-session', 3000, onExpire);
    vi.advanceTimersByTime(1000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2500);
    expect(onExpire).toHaveBeenCalled();
  });
});
