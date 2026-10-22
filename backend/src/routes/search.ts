import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { Repository } from '../models/Repository';
import { SearchHistory } from '../models/SearchHistory';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const searchRouter = Router();
searchRouter.use(authenticate);

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  repositoryId: z.string(),
  mode: z
    .enum(['bm25', 'vector', 'hybrid', 'hybrid_rerank', 'hybrid_rerank_context'])
    .default('hybrid_rerank'),
  topK: z.number().int().min(1).max(50).default(10),
  languageFilter: z.string().optional(),
  pathFilter: z.string().optional(),
  symbolTypeFilter: z.string().optional(),
  rerankerEnabled: z.boolean().default(true),
  contextExpansion: z.boolean().default(false),
});

// POST /api/search
searchRouter.post(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const params = searchSchema.parse(req.body);

      // Verify repository ownership
      const repo = await Repository.findOne({
        _id: params.repositoryId,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      if (repo.indexStatus !== 'completed') {
        throw new AppError(
          `Repository is not indexed yet. Status: ${repo.indexStatus}`,
          400
        );
      }

      const startTime = Date.now();
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

      const aiResponse = await axios.post(`${aiUrl}/search`, {
        query: params.query,
        repository_id: params.repositoryId,
        mode: params.mode,
        top_k: params.topK,
        language_filter: params.languageFilter,
        path_filter: params.pathFilter,
        symbol_type_filter: params.symbolTypeFilter,
        reranker_enabled: params.rerankerEnabled,
        context_expansion: params.contextExpansion,
      });

      const durationMs = Date.now() - startTime;

      // Store search history
      const history = await SearchHistory.create({
        userId: req.userId,
        repositoryId: params.repositoryId,
        query: params.query,
        retrievalConfig: {
          mode: params.mode,
          topK: params.topK,
          rerankerEnabled: params.rerankerEnabled,
          contextExpansion: params.contextExpansion,
          languageFilter: params.languageFilter,
          pathFilter: params.pathFilter,
        },
        resultCount: aiResponse.data.results?.length || 0,
        durationMs,
      });

      res.json({
        searchId: history._id,
        results: aiResponse.data.results,
        totalCandidates: aiResponse.data.total_candidates,
        durationMs,
        query: params.query,
        mode: params.mode,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/search/history
searchRouter.get(
  '/history',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        SearchHistory.find({ userId: req.userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('repositoryId', 'name'),
        SearchHistory.countDocuments({ userId: req.userId }),
      ]);

      res.json({ history: items, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);
