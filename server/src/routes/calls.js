import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { iceServers } from '../controllers/callController.js';

const router = Router();
router.get('/ice-servers', authenticate, iceServers);

export default router;
