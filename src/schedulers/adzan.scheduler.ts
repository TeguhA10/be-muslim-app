import cron from 'node-cron';
import { logger } from '../utils/logger';
import { NotificationModel } from '../models/notification.model';

export const initAdzanScheduler = () => {
  logger.info('[Scheduler] Initializing Notification & Adzan Cron Scheduler...');

  // 1. Check prayer times every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Scheduler] Checking upcoming prayer times for push notifications...');
  });

  // 2. Retention Policy: Daily cleanup at 02:00 AM for notifications older than 30 days
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('[Scheduler] Starting daily cleanup of notifications older than 30 days...');
      const deletedCount = await NotificationModel.cleanupOldNotifications(30);
      logger.info(`[Scheduler] Daily notification cleanup complete. Purged ${deletedCount} old records.`);
    } catch (error: any) {
      logger.error(`[Scheduler] Error cleaning up old notifications: ${error.message}`);
    }
  });
};
