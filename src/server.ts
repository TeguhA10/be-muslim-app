import app from './app';
import { ENV } from './config/env';
import { connectRedis } from './config/redis';
import { initAdzanScheduler } from './schedulers/adzan.scheduler';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // 1. Connect Redis
    await connectRedis();

    // 2. Init Cron Job Scheduler
    initAdzanScheduler();

    // 3. Start Listening
    app.listen(ENV.PORT, () => {
      logger.info(`[Server] Muslim App Backend API running on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
    });
  } catch (error: any) {
    logger.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
