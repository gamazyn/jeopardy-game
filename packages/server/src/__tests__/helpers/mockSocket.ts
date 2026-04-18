import { vi } from 'vitest';

export interface MockEmit {
  event: string;
  args: unknown[];
}

export function makeMockSocket(id = 'socket-id') {
  const emitted: MockEmit[] = [];
  const handlers: Record<string, (...args: unknown[]) => void> = {};

  const socket = {
    id,
    emitted,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      emitted.push({ event, args });
    }),
    join: vi.fn(),
    to: vi.fn(() => socket),
    // Trigger an event as if received from client
    trigger: (event: string, ...args: unknown[]) => {
      handlers[event]?.(...args);
    },
    _handlers: handlers,
  };

  return socket;
}

export function makeMockIo() {
  const emitted: MockEmit[] = [];
  const roomEmitted: Record<string, MockEmit[]> = {};

  const io = {
    emitted,
    roomEmitted,
    sockets: { adapter: { rooms: new Map<string, Set<string>>() } },
    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, ...args: unknown[]) => {
        emitted.push({ event, args });
        if (!roomEmitted[room]) roomEmitted[room] = [];
        roomEmitted[room].push({ event, args });
      }),
    })),
    getEmittedTo: (room: string) => roomEmitted[room] ?? [],
  };

  return io;
}
