import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@jeopardy/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
