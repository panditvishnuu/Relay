import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.js';
import {
  login,
  loginSchema,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  registerSchema,
} from '../controllers/auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, validate(registerSchema), register);
authRoutes.post('/login', authLimiter, validate(loginSchema), login);
authRoutes.post('/refresh', refreshLimiter, refresh); // authenticated by the cookie, not the header
authRoutes.post('/logout', logout);
authRoutes.post('/logout-all', requireAuth, logoutAll);
authRoutes.get('/me', requireAuth, me);
