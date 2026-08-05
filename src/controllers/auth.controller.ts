import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { CloudinaryService } from '../services/cloudinary.service';
import { NotificationModel } from '../models/notification.model';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { validatePasswordComplexity } from '../utils/password';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        sendError(res, 'Nama, email, dan kata sandi wajib diisi', null, 400);
        return;
      }

      const passCheck = validatePasswordComplexity(password);
      if (!passCheck.valid) {
        sendError(res, passCheck.message!, null, 400);
        return;
      }

      const result = await AuthService.register(name, email, password);
      sendSuccess(res, 'Pendaftaran berhasil. Silakan cek OTP di email.', result, 201);
    } catch (error: any) {
      next(error);
    }
  }

  static async verifyEmailOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        sendError(res, 'Email dan kode OTP 6 digit wajib diisi', null, 400);
        return;
      }

      const result = await AuthService.verifyEmailOtp(email, code);
      sendSuccess(res, 'Verifikasi email berhasil! Akun Anda telah aktif.', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        sendError(res, 'Email dan kata sandi wajib diisi', null, 400);
        return;
      }

      const result = await AuthService.login(email, password);
      sendSuccess(res, 'Login berhasil', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async requestForgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        sendError(res, 'Alamat email wajib diisi', null, 400);
        return;
      }

      const result = await AuthService.requestForgotPassword(email);
      sendSuccess(res, 'Kode OTP reset kata sandi dikirim', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async resetPasswordWithOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, new_password } = req.body;
      if (!email || !code || !new_password) {
        sendError(res, 'Email, kode OTP, dan kata sandi baru wajib diisi', null, 400);
        return;
      }

      const passCheck = validatePasswordComplexity(new_password);
      if (!passCheck.valid) {
        sendError(res, passCheck.message!, null, 400);
        return;
      }

      const result = await AuthService.resetPasswordWithOtp(email, code, new_password);
      sendSuccess(res, 'Kata sandi berhasil diperbarui', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        sendError(res, 'Refresh Token wajib disertakan', null, 400);
        return;
      }

      const result = await AuthService.refreshAccessToken(refresh_token);
      sendSuccess(res, 'Access Token berhasil diperbarui', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers['authorization'] || null;
      const userId = req.user?.id || '';

      if (userId) {
        await NotificationModel.clearPushToken(userId);
      }

      const result = await AuthService.logout(authHeader, userId);
      sendSuccess(res, 'Berhasil logout', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const timezone = req.headers['x-timezone'] as string || '';
      const result = await AuthService.getUserProfile(userId, timezone);
      sendSuccess(res, 'User profile fetched', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const settings = await AuthService.updateSettings(userId, req.body);
      sendSuccess(res, 'User settings updated successfully', settings);
    } catch (error: any) {
      next(error);
    }
  }

  static async requestChangePasswordOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const result = await AuthService.requestChangePasswordOtp(userId);
      sendSuccess(res, result.message, result);
    } catch (error: any) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const { old_password, otp_code, new_password } = req.body;
      if (!new_password) {
        sendError(res, 'Kata sandi baru wajib diisi', null, 400);
        return;
      }

      const passCheck = validatePasswordComplexity(new_password);
      if (!passCheck.valid) {
        sendError(res, passCheck.message!, null, 400);
        return;
      }

      const result = await AuthService.changePassword(userId, { old_password, otp_code, new_password });
      sendSuccess(res, result.message, result);
    } catch (error: any) {
      next(error);
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }

      if (!req.file) {
        sendError(res, 'File foto profil tidak ditemukan dalam request.', null, 400);
        return;
      }

      // Upload & compress directly to Cloudinary (~50KB avatar)
      const avatarUrl = await CloudinaryService.uploadAvatar(req.file.buffer);
      const updatedUser = await AuthService.updateAvatar(userId, avatarUrl);

      sendSuccess(res, 'Foto profil berhasil diunggah dan disimpan di Cloudinary!', updatedUser);
    } catch (error: any) {
      next(error);
    }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const { name, gender, birth_date, bio } = req.body;
      const updatedUser = await AuthService.updateProfile(userId, { name, gender, birth_date, bio });
      sendSuccess(res, 'Profil dan biodata berhasil diperbarui', updatedUser);
    } catch (error: any) {
      next(error);
    }
  }

  static async getPublicProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params.id as string;
      if (!targetUserId) {
        sendError(res, 'ID pengguna wajib disertakan.', null, 400);
        return;
      }
      const currentUserId = req.user?.id || null;
      const data = await AuthService.getPublicUserProfile(targetUserId, currentUserId);
      sendSuccess(res, 'Profil pengguna berhasil dimuat', data);
    } catch (error: any) {
      next(error);
    }
  }

  static async toggleFollow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const followerId = req.user?.id;
      if (!followerId) {
        sendError(res, 'Anda harus login terlebih dahulu', null, 401);
        return;
      }
      const targetUserId = req.params.id as string;
      if (!targetUserId) {
        sendError(res, 'ID pengguna wajib disertakan', null, 400);
        return;
      }

      const result = await AuthService.toggleFollowUser(followerId, targetUserId);
      const message = result.is_following ? 'Berhasil mengikuti pengguna' : 'Berhasil berhenti mengikuti pengguna';
      sendSuccess(res, message, result);
    } catch (error: any) {
      next(error);
    }
  }

  static async getFollowers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params.id as string;
      const currentUserId = req.user?.id || null;
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = parseInt((req.query.offset as string) || '0', 10);
      const search = (req.query.search as string) || '';
      const data = await AuthService.getFollowersList(targetUserId, currentUserId, limit, offset, search);
      sendSuccess(res, 'Daftar pengikut berhasil dimuat', data);
    } catch (error: any) {
      next(error);
    }
  }

  static async getFollowing(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params.id as string;
      const currentUserId = req.user?.id || null;
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = parseInt((req.query.offset as string) || '0', 10);
      const search = (req.query.search as string) || '';
      const data = await AuthService.getFollowingList(targetUserId, currentUserId, limit, offset, search);
      sendSuccess(res, 'Daftar mengikuti berhasil dimuat', data);
    } catch (error: any) {
      next(error);
    }
  }
}

