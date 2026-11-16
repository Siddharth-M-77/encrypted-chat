import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { zObjectId } from '../utils/objectId.js';
import { wrappedKey } from '../utils/validators.js';
import * as ctrl from '../controllers/conversationController.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(30),
    }),
  }),
  ctrl.list
);
router.post('/direct', validate({ body: z.object({ userId: zObjectId }) }), ctrl.createDirect);
router.get(
  '/:id/messages',
  validate({
    params: z.object({ id: zObjectId }),
    query: z.object({ before: zObjectId.optional(), limit: z.coerce.number().int().min(1).max(50).default(30) }),
  }),
  ctrl.listMessages
);

const idParam = z.object({ id: zObjectId });
const text = (min, max) => z.string().trim().min(min).max(max).refine((v) => !/[<>]/.test(v), 'Invalid characters');
const keys = z.array(wrappedKey).min(1).max(100);
const version = z.number().int().min(1);

// Registered before the "/:id" routes so "group-keys" is not read as an id.
router.get('/group-keys', ctrl.allKeys);

router.post(
  '/group',
  validate({ body: z.object({ name: text(1, 60), memberIds: z.array(zObjectId).min(1).max(99), encryptedKeys: keys }).strict() }),
  ctrl.createGroup
);
router.patch(
  '/:id',
  validate({
    params: idParam,
    body: z.object({ name: text(1, 60), avatarUrl: z.union([z.literal(''), z.string().url().max(500).regex(/^https?:\/\//)]) }).partial().strict(),
  }),
  ctrl.updateGroup
);
router.post(
  '/:id/members',
  validate({ params: idParam, body: z.object({ userIds: z.array(zObjectId).min(1).max(50), keyVersion: version, encryptedKeys: keys }).strict() }),
  ctrl.addMembers
);
router.delete(
  '/:id/members/:userId',
  validate({ params: z.object({ id: zObjectId, userId: zObjectId }), body: z.object({ keyVersion: version, encryptedKeys: keys }).strict() }),
  ctrl.removeMember
);
router.post('/:id/leave', validate({ params: idParam }), ctrl.leave);
router.get('/:id/keys', validate({ params: idParam }), ctrl.getKeys);
router.post(
  '/:id/keys/rotate',
  validate({ params: idParam, body: z.object({ keyVersion: version, encryptedKeys: keys }).strict() }),
  ctrl.rotateKeys
);

export default router;
