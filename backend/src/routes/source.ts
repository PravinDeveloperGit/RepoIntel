import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { Repository } from '../models/Repository';
import { AppError } from '../middleware/errorHandler';

export const sourceRouter = Router();
sourceRouter.use(authenticate);

async function assertRepoAccess(
  repoId: string,
  userId: string
): Promise<void> {
  const repo = await Repository.findOne({
    _id: repoId,
    ownerId: userId,
  });
  if (!repo) throw new AppError('Repository not found.', 404);
  if (repo.indexStatus !== 'completed') {
    throw new AppError('Repository is not indexed.', 400);
  }
}

// GET /api/repositories/:repoId/files
sourceRouter.get(
  '/repositories/:repoId/files',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await assertRepoAccess(req.params.repoId as string, req.userId!);
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.get(
        `${aiUrl}/repository/${req.params.repoId}/files`
      );
      res.json(response.data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:repoId/source?path=...&startLine=...&endLine=...
sourceRouter.get(
  '/repositories/:repoId/source',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await assertRepoAccess(req.params.repoId as string, req.userId!);
      const filePath = req.query.path as string;
      if (!filePath) throw new AppError('path query parameter required.', 400);

      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.get(
        `${aiUrl}/repository/${req.params.repoId}/source`,
        {
          params: {
            path: filePath,
            start_line: req.query.startLine,
            end_line: req.query.endLine,
          },
        }
      );
      res.json(response.data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:repoId/symbols
sourceRouter.get(
  '/repositories/:repoId/symbols',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await assertRepoAccess(req.params.repoId as string, req.userId!);
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.get(
        `${aiUrl}/repository/${req.params.repoId}/symbols`,
        { params: req.query }
      );
      res.json(response.data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:repoId/relationships
sourceRouter.get(
  '/repositories/:repoId/relationships',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await assertRepoAccess(req.params.repoId as string, req.userId!);
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.get(
        `${aiUrl}/repository/${req.params.repoId}/relationships`,
        { params: req.query }
      );
      res.json(response.data);
    } catch (err) {
      next(err);
    }
  }
);
