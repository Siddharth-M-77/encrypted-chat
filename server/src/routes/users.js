import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { zObjectId } from '../utils/objectId.js';
import { searchLimiter, blockLimiter } from '../middlewares/rateLimit.js';
import { b64Bytes } from '../utils/validators.js';
import * as ctrl from '../controllers/userController.js';

const router = Router();

const keysSchema = z.object({
  publicKey: b64Bytes(32),                       // X25519 public key
  encryptedPrivateKeyBackup: b64Bytes(24 + 32 + 16), // nonce + secretbox(secretKey) incl. 16-byte MAC
  keySalt: b64Bytes(16),                         // PBKDF2 salt
  replace: z.boolean().optional(),               // explicit opt-in to change an existing public key
}).strict();
router.use(authenticate);

// Plain-text fields only; reject anything that looks like markup to keep stored profiles clean.
const noHtml = (s) => !/[<>]/.test(s);
const safeText = (max) => z.string().trim().max(max).refine(noHtml, 'Invalid characters');

const profileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 chars: a-z, 0-9, _')
      .nullable(),
    displayName: safeText(40),
    bio: safeText(160),
    avatarUrl: z.union([z.literal(''), z.string().url().max(500).regex(/^https?:\/\//)]),
  })
  .partial()
  .strict();

router.get('/me/keys', ctrl.getKeys);
router.get('/me/blocked', ctrl.blocked);
router.put('/me/keys', validate({ body: keysSchema }), ctrl.putKeys);
router.get('/search', searchLimiter, validate({ query: z.object({ q: z.string().trim().min(2).max(60) }) }), ctrl.search);
router.patch('/me', validate({ body: profileSchema }), ctrl.updateMe);
const idParam = validate({ params: z.object({ id: zObjectId }) });
router.post('/:id/block', blockLimiter, idParam, ctrl.block);
router.delete('/:id/block', blockLimiter, idParam, ctrl.unblock);
router.get('/:id', idParam, ctrl.getById);

export default router;
