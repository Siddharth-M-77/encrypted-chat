import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { zObjectId } from '../utils/objectId.js';
import { uploadTmpDir } from '../services/storage/index.js';
import * as ctrl from '../controllers/fileController.js';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Streams straight to a temp file on disk, so large uploads do not sit in memory.
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadTmpDir,
    filename: (_req, _file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 4, parts: 6 },
});

const router = Router();
router.use(authenticate);

// Authentication and rate limiting run BEFORE the body is accepted.
router.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  validate({ body: z.object({ conversationId: zObjectId }) }),
  ctrl.upload
);
router.get('/:id', validate({ params: z.object({ id: zObjectId }) }), ctrl.download);

export default router;
