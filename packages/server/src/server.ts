import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { resolve } from 'path';
import type { ServerToClientEvents, ClientToServerEvents } from '@jeopardy/shared';
import { PORT, CLIENT_URL, GAMES_DIR, NODE_ENV } from './config.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { gameRouter } from './routes/gameRoutes.js';
import { mediaRouter } from './routes/mediaRoutes.js';
import { registerLobbyHandlers, setTunnelUrl } from './handlers/lobbyHandler.js';
import { registerGameHandlers } from './handlers/gameHandler.js';
import { registerBuzzerHandlers } from './handlers/buzzerHandler.js';
import { registerFinalHandlers } from './handlers/finalHandler.js';

export function createApp(): { app: ReturnType<typeof express>; httpServer: ReturnType<typeof createServer>; io: Server<ClientToServerEvents, ServerToClientEvents>; setTunnelUrl: typeof setTunnelUrl } {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false, // Desabilitar pois o client é servido pelo Vite em dev
    }),
  );
  app.use(cors({ origin: CLIENT_URL }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiLimiter);

  // Rotas REST
  app.use('/api/games', gameRouter);
  app.use('/api/games/:gameId/media', mediaRouter);

  // Servir mídia estática
  app.use('/media/:gameId', (req, res, next) => {
    const gameId = req.params.gameId;
    // Sanitizar gameId para evitar path traversal
    if (!/^[a-f0-9-]{36}$/.test(gameId)) {
      res.status(400).send('Invalid game ID');
      return;
    }
    express.static(resolve(GAMES_DIR, gameId, 'media'), {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      },
    })(req, res, next);
  });

  // Em produção, servir o client buildado
  if (NODE_ENV === 'production') {
    const clientDist = resolve(process.cwd(), '../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: CLIENT_URL },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.on('connection', (socket) => {
    console.log(`[socket] Conectado: ${socket.id}`);

    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerBuzzerHandlers(io, socket);
    registerFinalHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Desconectado: ${socket.id} (${reason})`);
    });
  });

  return { app, httpServer, io, setTunnelUrl };
}
