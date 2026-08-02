import cron from 'node-cron';
import { logger } from '../utils/logger';
import { NotificationModel } from '../models/notification.model';
import { PostService } from '../services/post.service';

export const initAdzanScheduler = () => {
  logger.info('[Scheduler] Initializing Notification & Adzan Cron Scheduler...');

  // 1. Check prayer times every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Scheduler] Checking upcoming prayer times for push notifications...');
  });

  // 2. Retention Policy: Daily cleanup at 02:00 AM for notifications & soft-deleted posts older than 30 days
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('[Scheduler] Starting daily cleanup of notifications & soft-deleted posts older than 30 days...');
      const deletedNotifs = await NotificationModel.cleanupOldNotifications(30);
      const purgedPosts = await PostService.purgeOldDeletedPosts(30);
      logger.info(`[Scheduler] Daily retention cleanup complete. Purged ${deletedNotifs} old notifications & ${purgedPosts} old deleted posts.`);
    } catch (error: any) {
      logger.error(`[Scheduler] Error during daily retention cleanup: ${error.message}`);
    }
  });
};
