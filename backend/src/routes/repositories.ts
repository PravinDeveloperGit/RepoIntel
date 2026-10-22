import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { Repository } from '../models/Repository';
import { IndexingJob } from '../models/IndexingJob';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const repositoriesRouter = Router();
repositoriesRouter.use(authenticate);

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10);
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new AppError('Only ZIP archives are accepted.', 400) as any);
    }
  },
});

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// POST /api/repositories
repositoriesRouter.post(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, description } = createRepoSchema.parse(req.body);
      const repo = await Repository.create({
        ownerId: req.userId,
        name,
        description: description || '',
      });
      res.status(201).json({ repository: repo });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories
repositoriesRouter.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10));
      const skip = (page - 1) * limit;

      const [repos, total] = await Promise.all([
        Repository.find({ ownerId: req.userId })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        Repository.countDocuments({ ownerId: req.userId }),
      ]);

      res.json({ repositories: repos, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:id
repositoriesRouter.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOne({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      res.json({ repository: repo });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/repositories/:id
repositoriesRouter.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);

      // Notify AI service to delete index
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      axios
        .delete(`${aiUrl}/index/${req.params.id}`)
        .catch((e) => logger.warn('AI service delete failed', e.message));

      res.json({ message: 'Repository deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/repositories/:id/upload
repositoriesRouter.post(
  '/:id/upload',
  upload.single('archive'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOne({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      if (!req.file) throw new AppError('No file uploaded.', 400);

      // Check if there is an active job
      const activeJob = await IndexingJob.findOne({
        repositoryId: repo._id,
        status: { $in: ['pending', 'processing'] },
      });
      if (activeJob) {
        throw new AppError('An indexing job is already in progress.', 409);
      }

      // Create indexing job
      const job = await IndexingJob.create({
        repositoryId: repo._id,
        ownerId: req.userId,
        status: 'pending',
        embeddingModel:
          process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
      });

      // Update repo status
      repo.indexStatus = 'pending';
      repo.storagePath = req.file.path;
      await repo.save();

      // Dispatch to AI service (fire-and-forget from backend perspective)
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const payload = {
        jobId: String(job._id),
        repositoryId: String(repo._id),
        filePath: req.file.path,
        embeddingModel:
          process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
      };

      axios.post(`${aiUrl}/index`, payload).catch((e) => {
        logger.error('Failed to dispatch indexing job to AI service', e.message);
        job.status = 'failed';
        (job as any).errors = [e.message];
        job.save();
        repo.indexStatus = 'failed';
        repo.save();
      });

      res.status(202).json({
        message: 'Upload accepted. Indexing started.',
        jobId: job._id,
      });
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      next(err);
    }
  }
);

// POST /api/repositories/:id/index (reindex)
repositoriesRouter.post(
  '/:id/index',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOne({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      if (!repo.storagePath) {
        throw new AppError('No uploaded archive found. Upload first.', 400);
      }

      const activeJob = await IndexingJob.findOne({
        repositoryId: repo._id,
        status: { $in: ['pending', 'processing'] },
      });
      if (activeJob) throw new AppError('Indexing already in progress.', 409);

      const job = await IndexingJob.create({
        repositoryId: repo._id,
        ownerId: req.userId,
        status: 'pending',
        embeddingModel: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
      });

      repo.indexStatus = 'pending';
      await repo.save();

      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      axios
        .post(`${aiUrl}/index`, {
          jobId: String(job._id),
          repositoryId: String(repo._id),
          filePath: repo.storagePath,
          embeddingModel: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
        })
        .catch((e) => logger.error('Reindex dispatch failed', e.message));

      res.status(202).json({ message: 'Reindexing started.', jobId: job._id });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:id/index-status
repositoriesRouter.get(
  '/:id/index-status',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOne({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);

      const job = await IndexingJob.findOne({
        repositoryId: repo._id,
      }).sort({ createdAt: -1 });

      res.json({ indexStatus: repo.indexStatus, job });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/repositories/:id/statistics
repositoriesRouter.get(
  '/:id/statistics',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const repo = await Repository.findOne({
        _id: req.params.id,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      res.json({
        indexStats: repo.indexStats,
        fileCount: repo.fileCount,
        chunkCount: repo.chunkCount,
        languages: repo.languages,
      });
    } catch (err) {
      next(err);
    }
  }
);
