import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { parseCookie } from 'cookie';
import { env } from '../config/env.js';
import { createRedis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { User } from '../models/User.js';
import { COOKIE_NAME, verifyToken } from '../utils/token.js';

import { getIo, setIo } from './io.js';
import { registerCallHandlers } from './calls.js';
import { registerChatHandlers, onConnect, onDisconnect, userRoom } from './chat.js';

export { userRoom, getIo };

let io;

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
    maxHttpBufferSize: 1e6,
  });

  setIo(io);

  // Redis adapter lets events cross PM2 cluster workers.
  io.adapter(createAdapter(createRedis('sio-pub'), createRedis('sio-sub')));

  // Authenticate every connection with the same JWT cookie used by the REST API.
  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie || '')[COOKIE_NAME];
      if (!token) return next(new Error('unauthorized'));
      const { sub } = verifyToken(token);
      const user = await User.findById(sub).select('_id');
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = user._id.toString();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));
    logger.debug({ userId, sid: socket.id }, 'socket connected');
    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);
    onConnect(io, socket).catch((err) => logger.error({ err: err.message }, 'onConnect failed'));
    socket.on('disconnect', () => {
      logger.debug({ userId, sid: socket.id }, 'socket disconnected');
      onDisconnect(io, socket).catch((err) => logger.error({ err: err.message }, 'onDisconnect failed'));
    });
  });

  return io;
}
