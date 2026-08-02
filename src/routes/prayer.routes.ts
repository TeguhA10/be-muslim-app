import { Router } from 'express';
import { PrayerController } from '../controllers/prayer.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/times', PrayerController.getPrayerTimes);
router.get('/hijri', PrayerController.getHijriDate);
router.get('/events', PrayerController.getIslamicEvents);

router.get('/logs', authenticateToken, PrayerController.getPrayerLogs);
router.get('/history', authenticateToken, PrayerController.getPrayerHistory);
router.post('/log', authenticateToken, PrayerController.logPrayer);

export default router;
