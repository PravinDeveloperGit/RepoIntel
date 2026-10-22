import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/database';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Repository Intelligence API running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
