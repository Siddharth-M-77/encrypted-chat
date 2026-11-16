import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.js';
import { deleteLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { zObjectId } from '../utils/objectId.js';
import * as ctrl from '../controllers/messageController.js';

const router = Router();
router.use(authenticate);

router.delete(
  '/:id',
  deleteLimiter,
  validate({
    params: z.object({ id: zObjectId }),
    query: z.object({ scope: z.enum(['me', 'everyone']), fileId: zObjectId.optional() }),
  }),
  ctrl.remove
);

export default router;
