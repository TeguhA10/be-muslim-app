import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { NotificationModel } from '../models/notification.model';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

export class NotificationController {
  /**
   * GET /api/notifications
   * List paginated notifications for logged in user
   */
  static async getNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await NotificationModel.getNotificationsByUserId(userId, page, limit);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      logger.error(`[NotificationController] getNotifications error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Get total unread count for badge icon
   */
  static async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(200).json({
        status: 'success',
        data: { unreadCount },
      });
    } catch (error: any) {
      logger.error(`[NotificationController] getUnreadCount error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a single notification as read
   */
  static async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const updated = await NotificationModel.markAsRead(id, userId);

      res.status(200).json({
        status: 'success',
        data: { updated },
      });
    } catch (error: any) {
      logger.error(`[NotificationController] markAsRead error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Mark all user's notifications as read
   */
  static async markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      await NotificationModel.markAllAsRead(userId);

      res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      logger.error(`[NotificationController] markAllAsRead error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/notifications/push-token
   * Save / update user device Expo Push Token
   */
  static async registerPushToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      if (!token || typeof token !== 'string') {
        res.status(400).json({ status: 'error', message: 'Push token is required' });
        return;
      }

      await NotificationModel.savePushToken(userId, token);

      res.status(200).json({
        status: 'success',
        message: 'Push token registered successfully',
      });
    } catch (error: any) {
      logger.error(`[NotificationController] registerPushToken error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * POST /api/notifications/broadcast
   * Broadcast notification/announcement to all users
   */
  static async broadcast(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, body } = req.body;
      if (!title || !body) {
        res.status(400).json({ status: 'error', message: 'Title and body are required' });
        return;
      }

      const result = await NotificationService.broadcastAnnouncement(title, body);

      res.status(200).json({
        status: 'success',
        message: 'Broadcast notification sent successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error(`[NotificationController] broadcast error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/notifications/clear-all
   * Delete all notifications for logged in user
   */
  static async deleteAllNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      await NotificationModel.deleteAllNotifications(userId);

      res.status(200).json({
        status: 'success',
        message: 'All notifications deleted successfully',
      });
    } catch (error: any) {
      logger.error(`[NotificationController] deleteAllNotifications error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a single notification by ID
   */
  static async deleteNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const deleted = await NotificationModel.deleteNotification(id, userId);

      res.status(200).json({
        status: 'success',
        data: { deleted },
      });
    } catch (error: any) {
      logger.error(`[NotificationController] deleteNotification error: ${error.message}`);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }
}
