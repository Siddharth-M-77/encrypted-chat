import { Router } from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis.js';
import auth from './auth.js';
import users from './users.js';
import conversations from './conversations.js';
import files from './files.js';
import calls from './calls.js';
import messages from './messages.js';

const router = Router();
// Readiness: reports whether MongoDB and Redis are reachable (used by load balancers / uptime checks).
router.get('/health', async (_req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  const redisOk = await redis.ping().then((r) => r === 'PONG').catch(() => false);
  res.status(mongo && redisOk ? 200 : 503).json({ success: mongo && redisOk, message: mongo && redisOk ? 'ok' : 'degraded', data: { mongo, redis: redisOk } });
});
router.use('/auth', auth);
router.use('/users', users);
router.use('/conversations', conversations);
router.use('/files', files);
router.use('/calls', calls);
router.use('/messages', messages);

export default router;
