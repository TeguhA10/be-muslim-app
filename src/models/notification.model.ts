import { pool } from '../config/database';
import { Notification, NotificationType } from './index';

export class NotificationModel {
  /**
   * Save or update user push token (Expo Push Token or FCM token)
   * Also unassigns this device token from any previous user account on this device.
   */
  static async savePushToken(userId: string, token: string): Promise<void> {
    // Unbind token from old user accounts on the same device
    await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id != $2', [token, userId]);

    const query = `
      UPDATE users
      SET fcm_token = $1
      WHERE id = $2
    `;
    await pool.query(query, [token, userId]);
  }

  /**
   * Clear user push token upon logout
   */
  static async clearPushToken(userId: string): Promise<void> {
    const query = `
      UPDATE users
      SET fcm_token = NULL
      WHERE id = $1
    `;
    await pool.query(query, [userId]);
  }

  /**
   * Get user push token
   */
  static async getUserPushToken(userId: string): Promise<string | null> {
    const query = `SELECT fcm_token FROM users WHERE id = $1`;
    const result = await pool.query(query, [userId]);
    return result.rows[0]?.fcm_token || null;
  }

  /**
   * Get all verified users for broadcast
   */
  static async getAllUsers(): Promise<{ id: string; fcm_token: string | null }[]> {
    const query = `SELECT id, fcm_token FROM users WHERE is_verified = TRUE`;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Create a new notification in DB
   */
  static async createNotification(data: {
    recipient_id: string;
    actor_id?: string;
    type: NotificationType;
    title: string;
    body: string;
    entity_type?: string;
    entity_id?: string;
  }): Promise<Notification> {
    const query = `
      INSERT INTO notifications (recipient_id, actor_id, type, title, body, entity_type, entity_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.recipient_id,
      data.actor_id || null,
      data.type,
      data.title,
      data.body,
      data.entity_type || null,
      data.entity_id || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get paginated notifications for a user, including actor's name & avatar
   */
  static async getNotificationsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) FROM notifications WHERE recipient_id = $1
    `;
    const countRes = await pool.query(countQuery, [userId]);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataQuery = `
      SELECT 
        n.*,
        u.name as actor_name,
        u.avatar_url as actor_avatar
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const dataRes = await pool.query(dataQuery, [userId, limit, offset]);

    return {
      notifications: dataRes.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Get count of unread notifications for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM notifications
      WHERE recipient_id = $1 AND is_read = FALSE
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND recipient_id = $2
    `;
    const result = await pool.query(query, [notificationId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark all notifications of a user as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE recipient_id = $1 AND is_read = FALSE
    `;
    await pool.query(query, [userId]);
  }

  /**
   * Delete a single notification by ID
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM notifications
      WHERE id = $1 AND recipient_id = $2
    `;
    const result = await pool.query(query, [notificationId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAllNotifications(userId: string): Promise<void> {
    const query = `
      DELETE FROM notifications
      WHERE recipient_id = $1
    `;
    await pool.query(query, [userId]);
  }

  /**
   * Automatic cleanup for old notifications (> 30 days)
   */
  static async cleanupOldNotifications(days: number = 30): Promise<number> {
    const query = `
      DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '1 day' * $1
    `;
    const result = await pool.query(query, [days]);
    return result.rowCount ?? 0;
  }
}
