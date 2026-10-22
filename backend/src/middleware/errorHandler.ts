import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const issues = (err as any).issues || (err as any).errors || [];
    res.status(400).json({
      error: 'Validation failed',
      details: issues.map((e: any) => ({
        field: Array.isArray(e.path) ? e.path.join('.') : '',
        message: e.message,
      })),
    });
    return;
  }

  // Operational errors (known, safe to surface)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    res.status(409).json({ error: 'Resource already exists.' });
    return;
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }

  // Unknown errors — do NOT expose internals in production
  logger.error('Unhandled error', err);
  res.status(500).json({
    error:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error.',
  });
}
