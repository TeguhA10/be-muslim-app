import { Router } from 'express';
import { PostController } from '../controllers/post.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.get('/categories', PostController.getCategories);
router.get('/upload-signature', authenticateToken, PostController.getUploadSignature);
router.get('/feed', PostController.getFeed);
router.get('/bookmarks/all', authenticateToken, PostController.getBookmarks);
router.get('/likes/all', authenticateToken, PostController.getLikedPosts);
router.get('/trash', authenticateToken, PostController.getTrashPosts);
router.post('/', authenticateToken, upload.array('images', 4), PostController.createPost);
router.post('/:id/like', authenticateToken, PostController.toggleLike);
router.post('/:id/bookmark', authenticateToken, PostController.toggleBookmark);
router.post('/:id/comments', authenticateToken, PostController.addComment);
router.get('/:id/comments', PostController.getComments);
router.delete('/:id', authenticateToken, PostController.deletePost);
router.delete('/:id/permanent', authenticateToken, PostController.permanentDeletePost);
router.post('/:id/restore', authenticateToken, PostController.restorePost);

export default router;
