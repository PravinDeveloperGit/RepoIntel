import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { EvaluationRun } from '../models/EvaluationRun';
import { AppError } from '../middleware/errorHandler';

export const evaluationRouter = Router();
evaluationRouter.use(authenticate);

const createRunSchema = z.object({
  datasetName: z.string().default('custom'),
  datasetVersion: z.string().default('v1'),
  splitId: z.string().default('test'),
  systemVariant: z.enum(['A', 'B', 'C', 'D', 'E']),
  repositoryId: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  randomSeed: z.number().default(42),
});

// POST /api/evaluation/runs
evaluationRouter.post(
  '/runs',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = createRunSchema.parse(req.body);
      const runId = uuidv4();

      const run = await EvaluationRun.create({
        runId,
        ...body,
        status: 'pending',
      });

      // Dispatch to AI service
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      axios
        .post(`${aiUrl}/evaluate`, {
          run_id: runId,
          system_variant: body.systemVariant,
          dataset_name: body.datasetName,
          dataset_version: body.datasetVersion,
          split_id: body.splitId,
          repository_id: body.repositoryId,
          config: body.config,
          random_seed: body.randomSeed,
        })
        .catch((e) => {
          run.status = 'failed';
          (run as any).errors = [e.message];
          run.save();
        });

      res.status(202).json({ runId, evaluationRun: run });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/evaluation/runs
evaluationRouter.get(
  '/runs',
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const runs = await EvaluationRun.find()
        .sort({ createdAt: -1 })
        .limit(50);
      res.json({ runs });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/evaluation/runs/:runId
evaluationRouter.get(
  '/runs/:runId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const run = await EvaluationRun.findOne({ runId: req.params.runId });
      if (!run) throw new AppError('Evaluation run not found.', 404);
      res.json({ run });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/evaluation/compare
evaluationRouter.get(
  '/compare',
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const runs = await EvaluationRun.find({ status: 'completed' }).sort({
        createdAt: -1,
      });
      // Group by systemVariant
      const byVariant: Record<string, typeof runs> = {};
      for (const run of runs) {
        if (!byVariant[run.systemVariant]) byVariant[run.systemVariant] = [];
        byVariant[run.systemVariant].push(run);
      }
      res.json({ comparison: byVariant });
    } catch (err) {
      next(err);
    }
  }
);
