import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);
router.post('/push-token', NotificationController.registerPushToken);
router.post('/broadcast', NotificationController.broadcast);
router.delete('/clear-all', NotificationController.deleteAllNotifications);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
