import { Router } from 'express';
import authRoutes from './auth.routes';
import prayerRoutes from './prayer.routes';
import postRoutes from './post.routes';
import masjidRoutes from './masjid.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/prayer', prayerRoutes);
router.use('/posts', postRoutes);
router.use('/masjid', masjidRoutes);
router.use('/notifications', notificationRoutes);

export default router;

