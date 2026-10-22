import { Router, Request, Response, NextFunction } from 'express';
import { Repository } from '../models/Repository';
import { IndexingJob } from '../models/IndexingJob';
import { EvaluationRun } from '../models/EvaluationRun';
import { logger } from '../utils/logger';

/**
 * Internal routes — called by the AI service to report job completion.
 * These should NOT be exposed to the public internet in production.
 * In production, use a shared secret or service mesh authentication.
 */
export const internalRouter = Router();

// PATCH /api/internal/jobs/:jobId — progress update
internalRouter.patch(
  '/jobs/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await IndexingJob.findById(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      if (req.body.status) job.status = req.body.status;
      if (req.body.progress !== undefined) job.progress = req.body.progress;
      await job.save();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/internal/jobs/:jobId/complete
internalRouter.post(
  '/jobs/:jobId/complete',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await IndexingJob.findById(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      job.status = 'completed';
      job.progress = 100;
      job.totalFiles = req.body.totalFiles || 0;
      job.processedFiles = req.body.processedFiles || 0;
      job.skippedFiles = req.body.skippedFiles || 0;
      job.chunkCount = req.body.chunkCount || 0;
      job.parseFailures = req.body.parseFailures || 0;
      job.durationMs = req.body.durationMs || 0;
      job.completedAt = new Date();
      await job.save();

      // Update repository
      const repo = await Repository.findById(job.repositoryId);
      if (repo) {
        repo.indexStatus = 'completed';
        repo.indexVersion += 1;
        repo.chunkCount = job.chunkCount;
        repo.fileCount = job.processedFiles;
        repo.languages = req.body.languages || [];
        repo.indexStats = {
          totalFiles: job.totalFiles,
          processedFiles: job.processedFiles,
          skippedFiles: job.skippedFiles,
          parseFailures: job.parseFailures,
          embeddingModel: job.embeddingModel,
          indexDurationMs: job.durationMs,
          indexedAt: new Date(),
        };
        await repo.save();
      }

      logger.info(`Indexing job ${req.params.jobId} completed`);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/internal/jobs/:jobId/fail
internalRouter.post(
  '/jobs/:jobId/fail',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await IndexingJob.findById(req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      job.status = 'failed';
      (job as any).errors = [...((job as any).errors || []), req.body.error || 'Unknown error'];
      job.completedAt = new Date();
      await job.save();

      const repo = await Repository.findById(job.repositoryId);
      if (repo) {
        repo.indexStatus = 'failed';
        await repo.save();
      }

      logger.warn(`Indexing job ${req.params.jobId} failed: ${req.body.error}`);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/internal/evaluation/:runId
internalRouter.patch(
  '/evaluation/:runId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const run = await EvaluationRun.findOne({ runId: req.params.runId });
      if (!run) return res.status(404).json({ error: 'Run not found' });
      if (req.body.status) run.status = req.body.status;
      if (req.body.status === 'running') run.startedAt = new Date();
      await run.save();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/internal/evaluation/:runId/complete
internalRouter.post(
  '/evaluation/:runId/complete',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const run = await EvaluationRun.findOne({ runId: req.params.runId });
      if (!run) return res.status(404).json({ error: 'Run not found' });

      const m = req.body.metrics || {};
      run.status = 'completed';
      run.completedAt = new Date();
      run.sampleCount = req.body.sampleCount || 0;
      run.metrics = {
        successAt1: m.success_at_1 ?? null,
        successAt5: m.success_at_5 ?? null,
        successAt10: m.success_at_10 ?? null,
        mrr: m.mrr ?? null,
        precisionAt5: m.precision_at_5 ?? null,
        precisionAt10: m.precision_at_10 ?? null,
        avgLatencyMs: m.avg_latency_ms ?? null,
        p50LatencyMs: m.p50_latency_ms ?? null,
        p90LatencyMs: m.p90_latency_ms ?? null,
        p99LatencyMs: null,
        llmCallCount: null,
        estimatedCostUsd: null,
      };
      await run.save();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/internal/evaluation/:runId/fail
internalRouter.post(
  '/evaluation/:runId/fail',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const run = await EvaluationRun.findOne({ runId: req.params.runId });
      if (!run) return res.status(404).json({ error: 'Run not found' });
      run.status = 'failed';
      (run as any).errors = [req.body.error || 'Unknown error'];
      run.completedAt = new Date();
      await run.save();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
