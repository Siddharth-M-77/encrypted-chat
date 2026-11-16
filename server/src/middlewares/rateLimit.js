import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis.js';

// Counters live in Redis, so limits hold across every PM2 worker instead of being per-process.
const store = (name) => new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: `rl:http:${name}:` });

const handler = (_req, res) =>
  res.status(429).json({ success: false, message: 'Too many requests, please slow down', data: null });

// Authenticated routes are limited per user; everything else per IP.
const perUserOrIp = (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip));

const make = (name, windowMs, limit, extra = {}) =>
  rateLimit({ standardHeaders: 'draft-7', legacyHeaders: false, windowMs, limit, handler, store: store(name), ...extra });

export const apiLimiter = make('api', 60_000, 300);
export const authLimiter = make('auth', 60_000, 20); // nonce + verify: blunt brute force
export const searchLimiter = make('search', 60_000, 30, { keyGenerator: perUserOrIp }); // user enumeration
export const blockLimiter = make('block', 60_000, 20, { keyGenerator: perUserOrIp });
export const deleteLimiter = make('delete', 60_000, 60, { keyGenerator: perUserOrIp });
export const uploadLimiter = make('upload', 60_000, 30, { keyGenerator: perUserOrIp }); // uploads are heavy
