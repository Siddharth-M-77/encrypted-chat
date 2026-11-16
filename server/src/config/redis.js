import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export function createRedis(name = 'main') {
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  client.on('error', (err) => logger.error({ err: err.message }, `Redis(${name}) error`));
  client.on('ready', () => logger.info(`Redis(${name}) ready`));
  return client;
}

// Shared client for nonces, presence, rate limits.
export const redis = createRedis('main');
