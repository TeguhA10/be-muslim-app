import { Router } from 'express';
import { MasjidController } from '../controllers/masjid.controller';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.get('/nearby', optionalAuthenticateToken, MasjidController.getNearbyMasjids);
router.get('/bookmarks/all', authenticateToken, MasjidController.getBookmarks);
router.post('/:id/bookmark', authenticateToken, MasjidController.toggleBookmark);

// Review routes
router.get('/:id/reviews/summary', optionalAuthenticateToken, MasjidController.getReviewSummary);
router.get('/:id/reviews', optionalAuthenticateToken, MasjidController.getReviews);
router.post('/:id/reviews', authenticateToken, upload.array('photos', 3), MasjidController.addOrUpdateReview);
router.delete('/reviews/:reviewId', authenticateToken, MasjidController.deleteReview);

export default router;
