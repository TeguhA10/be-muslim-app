import axios from 'axios';
import { logger } from '../utils/logger';
import { NotificationModel } from '../models/notification.model';
import { NotificationType } from '../models';
import { emitToUser, emitToAll } from '../config/socket';

export class NotificationService {
  /**
   * Send Expo / FCM Push notification to mobile device status bar
   */
  static async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    if (!pushToken) return false;

    try {
      logger.info(`[PushNotification] Sending push to token ${pushToken.substring(0, 25)}... | Title: ${title}`);
      
      const res = await axios.post(
        'https://exp.host/--/api/v2/push/send',
        {
          to: pushToken,
          sound: 'default',
          title,
          body,
          data: data || {},
          priority: 'high',
          channelId: 'social-interactions-channel',
        },
        {
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      const status = res.data?.data?.[0]?.status;
      if (status === 'error') {
        logger.error(`[PushNotification] Expo push error: ${res.data?.data?.[0]?.message || 'Unknown error'}`);
        return false;
      }

      logger.info(`[PushNotification] Push delivered successfully to Expo gateway`);
      return true;
    } catch (error: any) {
      logger.error(`[PushNotification] Push failed: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      return false;
    }
  }

  /**
   * Helper to create DB notification, send Push Notification to phone bar, AND emit WebSocket event
   */
  static async notifyUser(params: {
    recipientId: string;
    actorId?: string;
    type: NotificationType;
    title: string;
    body: string;
    entityType?: 'POST' | 'COMMENT' | 'USER' | 'PRAYER';
    entityId?: string;
  }): Promise<void> {
    try {
      // Do not notify self
      if (params.actorId && params.recipientId === params.actorId) {
        return;
      }

      // 1. Create DB record
      const notif = await NotificationModel.createNotification({
        recipient_id: params.recipientId,
        actor_id: params.actorId,
        type: params.type,
        title: params.title,
        body: params.body,
        entity_type: params.entityType,
        entity_id: params.entityId,
      });

      // 2. Fetch recipient's push token
      const pushToken = await NotificationModel.getUserPushToken(params.recipientId);

      // 3. Send Push Notification to HP Status Bar if token exists
      if (pushToken) {
        await this.sendPushNotification(pushToken, params.title, params.body, {
          notificationId: notif.id,
          entityType: params.entityType,
          entityId: params.entityId,
          type: params.type,
        });
      } else {
        logger.info(`[NotificationService] Recipient ${params.recipientId} has no registered push token yet`);
      }

      // 4. Emit real-time WebSocket event to active client session
      emitToUser(params.recipientId, 'notification:new', notif);
    } catch (error: any) {
      logger.error(`[NotificationService] Error notifying user ${params.recipientId}: ${error.message}`);
    }
  }

  /**
   * Broadcast announcement to ALL users (In-App DB + Push Notification + Real-time WebSocket)
   */
  static async broadcastAnnouncement(title: string, body: string): Promise<{ total: number; pushSent: number }> {
    try {
      const users = await NotificationModel.getAllUsers();
      let pushSent = 0;

      for (const user of users) {
        const notif = await NotificationModel.createNotification({
          recipient_id: user.id,
          type: 'SYSTEM',
          title,
          body,
        });

        if (user.fcm_token) {
          const sent = await this.sendPushNotification(user.fcm_token, title, body, {
            notificationId: notif.id,
            type: 'SYSTEM',
          });
          if (sent) pushSent++;
        }
      }

      // Broadcast WebSocket event to all active client sockets
      emitToAll('notification:new', { type: 'SYSTEM', title, body });

      return { total: users.length, pushSent };
    } catch (error: any) {
      logger.error(`[NotificationService] Error broadcasting announcement: ${error.message}`);
      throw error;
    }
  }
}
