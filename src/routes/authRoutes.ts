import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/authController.ts';
import { authLimiter } from '../middlewares/rateLimiter.ts';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
