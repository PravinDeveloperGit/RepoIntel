import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { repositoriesRouter } from './routes/repositories';
import { searchRouter } from './routes/search';
import { qaRouter } from './routes/qa';
import { feedbackRouter } from './routes/feedback';
import { evaluationRouter } from './routes/evaluation';
import { sourceRouter } from './routes/source';
import { internalRouter } from './routes/internal';

const app = express();

// ── Security ────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ── Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Health ───────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/repositories', repositoriesRouter);
app.use('/api/search', searchRouter);
app.use('/api/qa', qaRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/source', sourceRouter);
app.use('/api/internal', internalRouter);

// ── Errors ───────────────────────────────────────────────────
app.use(errorHandler);

export default app;
