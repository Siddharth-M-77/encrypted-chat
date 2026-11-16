import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import * as ctrl from '../controllers/authController.js';

const router = Router();

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address');

router.get('/nonce', authLimiter, validate({ query: z.object({ address }) }), ctrl.getNonce);
router.post(
  '/verify',
  authLimiter,
  validate({
    body: z.object({
      message: z.string().min(20).max(2000),
      signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature'),
    }),
  }),
  ctrl.verify
);
router.get('/me', authenticate, ctrl.me);
router.post('/logout', ctrl.logout);

export default router;
