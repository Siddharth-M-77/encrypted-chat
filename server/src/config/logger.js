import pino from 'pino';
import { env } from './env.js';

// Never log request bodies or message content; redact credentials defensively.
export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
