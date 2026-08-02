import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.post('/register', AuthController.register);
router.post('/verify-otp', AuthController.verifyEmailOtp);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.requestForgotPassword);
router.post('/reset-password', AuthController.resetPasswordWithOtp);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/logout', authenticateToken, AuthController.logout);

router.get('/user/:id', optionalAuthenticateToken, AuthController.getPublicProfile);
router.post('/user/:id/follow', authenticateToken, AuthController.toggleFollow);
router.get('/user/:id/followers', optionalAuthenticateToken, AuthController.getFollowers);
router.get('/user/:id/following', optionalAuthenticateToken, AuthController.getFollowing);

router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.get('/me', authenticateToken, AuthController.getProfile);
router.post('/settings', authenticateToken, AuthController.updateSettings);
router.post('/change-password-request-otp', authenticateToken, AuthController.requestChangePasswordOtp);
router.post('/change-password', authenticateToken, AuthController.changePassword);
router.post('/avatar', authenticateToken, upload.single('avatar'), AuthController.uploadAvatar);

export default router;

