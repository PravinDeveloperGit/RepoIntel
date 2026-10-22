import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { SearchFeedback } from '../models/SearchFeedback';
import { SearchHistory } from '../models/SearchHistory';
import { AppError } from '../middleware/errorHandler';

export const feedbackRouter = Router();
feedbackRouter.use(authenticate);

const feedbackSchema = z.object({
  searchId: z.string(),
  chunkId: z.string(),
  feedback: z.enum(['positive', 'negative']),
  category: z
    .enum([
      'correct_implementation',
      'partially_relevant',
      'irrelevant',
      'wrong_file',
      'missing_context',
    ])
    .optional(),
});

// POST /api/feedback
feedbackRouter.post(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { searchId, chunkId, feedback, category } = feedbackSchema.parse(req.body);

      const search = await SearchHistory.findOne({
        _id: searchId,
        userId: req.userId,
      });
      if (!search) throw new AppError('Search not found.', 404);

      const fb = await SearchFeedback.create({
        userId: req.userId,
        searchId,
        chunkId,
        feedback,
        category,
        repositoryId: search.repositoryId,
        query: search.query,
        retrievalConfig: search.retrievalConfig,
      });

      res.status(201).json({ feedback: fb });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/feedback/summary
feedbackRouter.get(
  '/summary',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repositoryId = req.query.repositoryId as string | undefined;
      const match: Record<string, unknown> = { userId: req.userId };
      if (repositoryId) match.repositoryId = repositoryId;

      const summary = await SearchFeedback.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$feedback',
            count: { $sum: 1 },
          },
        },
      ]);

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  }
);
