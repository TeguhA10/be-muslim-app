import cron from 'node-cron';
import { logger } from '../utils/logger';

export const initAdzanScheduler = () => {
  logger.info('[Scheduler] Initializing Adzan Notification Cron Scheduler...');

  // Runs every 5 minutes to check users' upcoming adzan & reminder times
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Scheduler] Checking upcoming prayer times for push notifications...');
    // In production: Query DB users with enabled notifications & match prayer time - offset
  });
};
