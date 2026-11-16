import { z } from 'zod';
import { logger } from '../config/logger.js';

// Personal room every socket of a user joins; events are delivered to people through it.
export const userRoom = (id) => `user:${id}`;

// Registers a socket event: validates the payload with zod, always acks, never leaks internals.
export function makeOn(socket) {
  return (event, schema, fn) =>
    socket.on(event, async (payload, ack) => {
      const cb = typeof ack === 'function' ? ack : () => {};
      try {
        const res = await fn(schema.parse(payload ?? {}));
        cb({ ok: true, ...(res || {}) });
      } catch (err) {
        if (err instanceof z.ZodError) return cb({ ok: false, message: 'Invalid payload' });
        if (!err.isOperational) logger.error({ err: err.message, event }, 'socket handler error');
        cb({ ok: false, message: err.isOperational ? err.message : 'Something went wrong' });
      }
    });
}
