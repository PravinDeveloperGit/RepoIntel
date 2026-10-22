import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET'];

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
}

export async function connectDB(): Promise<void> {
  validateEnv();
  const uri = process.env.MONGODB_URI!;
  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'repointel',
    });
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection failed', err);
    throw err;
  }
}
