import { redis } from '../config/redis.js';

// Fixed-window counter in Redis (shared by all PM2 workers). Returns true while under the limit.
export async function hit(key, limit, windowSeconds) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSeconds);
  return n <= limit;
}
