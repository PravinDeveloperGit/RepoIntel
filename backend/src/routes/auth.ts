import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/authenticate';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

// POST /api/auth/register
authRouter.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, displayName } = registerSchema.parse(req.body);

      const existing = await User.findOne({ email });
      if (existing) {
        throw new AppError('Email already registered.', 409);
      }

      // passwordHash field is hashed by the pre-save hook
      const user = new User({ email, passwordHash: password, displayName });
      await user.save();

      const token = signToken(String(user._id));
      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
authRouter.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        throw new AppError('Invalid email or password.', 401);
      }
      if (user.status !== 'active') {
        throw new AppError('Account is suspended.', 403);
      }
      const valid = await user.comparePassword(password);
      if (!valid) {
        throw new AppError('Invalid email or password.', 401);
      }

      const token = signToken(String(user._id));
      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/logout (stateless JWT — client discards token)
authRouter.post('/logout', authenticate, (_req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get(
  '/me',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) throw new AppError('User not found.', 404);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);
