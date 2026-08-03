import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { ENV } from '../config/env';
import { User } from '../models';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { getLocalDateStr } from '../utils/date';

function generate6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class AuthService {
  /**
   * Register User (Creates unverified account & sends 6-digit OTP)
   */
  static async register(name: string, email: string, password: string) {
    const otpExpiresInSeconds = 10 * 60;
    const existing = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].is_verified) {
        throw new Error('Email ini sudah terdaftar dan terverifikasi. Silakan langsung masuk (login).');
      } else {
        // Resend OTP for existing unverified user & update credentials
        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
          'UPDATE users SET name = $1, password_hash = $2 WHERE email = $3 AND is_verified = false',
          [name, passwordHash, email]
        );

        const otpCode = generate6DigitOtp();
        const expiresAt = new Date(Date.now() + otpExpiresInSeconds * 1000); // 10 mins

        await pool.query('DELETE FROM otp_codes WHERE email = $1 AND purpose = $2', [email, 'VERIFY_EMAIL']);
        await pool.query(
          `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'VERIFY_EMAIL', $3)`,
          [email, otpCode, expiresAt]
        );
        await EmailService.sendOtpEmail(email, otpCode, 'VERIFY_EMAIL');

        return {
          requires_otp: true,
          email,
          otp_expires_at: expiresAt.toISOString(),
          otp_expires_in_seconds: otpExpiresInSeconds,
          message: 'Akun belum diverifikasi. Kode OTP verifikasi baru telah dikirim ke email Anda.',
        };
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (name, email, password_hash, is_verified)
         VALUES ($1, $2, $3, false)
         RETURNING id, name, email, avatar_url, created_at, is_verified`,
        [name, email, passwordHash]
      );
      const user: User = userRes.rows[0];

      // Default user settings
      await client.query(
        `INSERT INTO user_settings (user_id, calculation_method, reminder_offset_minutes, notif_adzan_enabled, language)
         VALUES ($1, 'KEMENAG', 10, true, 'id')`,
        [user.id]
      );

      // Generate & save OTP code
      const otpCode = generate6DigitOtp();
      const expiresAt = new Date(Date.now() + otpExpiresInSeconds * 1000); // 10 mins

      await client.query(
        `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'VERIFY_EMAIL', $3)`,
        [email, otpCode, expiresAt]
      );

      await client.query('COMMIT');

      await EmailService.sendOtpEmail(email, otpCode, 'VERIFY_EMAIL');

      return {
        requires_otp: true,
        email,
        otp_expires_at: expiresAt.toISOString(),
        otp_expires_in_seconds: otpExpiresInSeconds,
        message: 'Registrasi berhasil. Silakan masukkan kode OTP 6 digit yang dikirim ke email Anda.',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Verify 6-Digit OTP for Email Verification
   */
  static async verifyEmailOtp(email: string, code: string) {
    const otpRes = await pool.query(
      `SELECT * FROM otp_codes
       WHERE email = $1 AND code = $2 AND purpose = 'VERIFY_EMAIL' AND expires_at > NOW()`,
      [email, code]
    );

    if (otpRes.rows.length === 0) {
      throw new Error('Kode OTP tidak valid atau sudah kadaluwarsa.');
    }

    // Set user as verified
    const userRes = await pool.query(
      `UPDATE users SET is_verified = true WHERE email = $1 RETURNING id, name, email, avatar_url, created_at, is_verified`,
      [email]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const user: User = userRes.rows[0];

    // Delete used OTP
    await pool.query(`DELETE FROM otp_codes WHERE email = $1 AND purpose = 'VERIFY_EMAIL'`, [email]);

    // Issue Access & Refresh Tokens
    const tokens = await AuthService.generateTokenPair(user.id, user.email);

    return { user, ...tokens };
  }

  /**
   * Login User (Verifies password & checks is_verified status)
   */
  static async login(email: string, password: string) {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      throw new Error('Email atau kata sandi tidak valid.');
    }

    const user: User = res.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!isMatch) {
      throw new Error('Email atau kata sandi tidak valid.');
    }

    if (!user.is_verified) {
      // Resend OTP for unverified user
      const otpExpiresInSeconds = 10 * 60;
      const otpCode = generate6DigitOtp();
      const expiresAt = new Date(Date.now() + otpExpiresInSeconds * 1000);
      await pool.query('DELETE FROM otp_codes WHERE email = $1 AND purpose = $2', [email, 'VERIFY_EMAIL']);
      await pool.query(
        `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'VERIFY_EMAIL', $3)`,
        [email, otpCode, expiresAt]
      );
      await EmailService.sendOtpEmail(email, otpCode, 'VERIFY_EMAIL');

      const err: any = new Error('AKUN_BELUM_VERIFIKASI: Silakan masukkan kode OTP yang dikirim ke email Anda.');
      err.statusCode = 403;
      err.details = {
        code: 'UNVERIFIED_EMAIL',
        email,
        otp_expires_at: expiresAt.toISOString(),
        otp_expires_in_seconds: otpExpiresInSeconds,
      };
      throw err;
    }

    delete user.password_hash;
    const tokens = await AuthService.generateTokenPair(user.id, user.email);

    return { user, ...tokens };
  }

  /**
   * Request Forgot Password (Sends 6-digit OTP to email)
   */
  static async requestForgotPassword(email: string) {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      throw new Error('Alamat email tidak terdaftar.');
    }

    const otpExpiresInSeconds = 10 * 60;
    const otpCode = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + otpExpiresInSeconds * 1000);

    await pool.query('DELETE FROM otp_codes WHERE email = $1 AND purpose = $2', [email, 'FORGOT_PASSWORD']);
    await pool.query(
      `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'FORGOT_PASSWORD', $3)`,
      [email, otpCode, expiresAt]
    );

    await EmailService.sendOtpEmail(email, otpCode, 'FORGOT_PASSWORD');

    return {
      email,
      otp_expires_at: expiresAt.toISOString(),
      otp_expires_in_seconds: otpExpiresInSeconds,
      message: 'Kode OTP reset kata sandi telah dikirim ke email Anda.',
    };
  }

  /**
   * Reset Password with OTP Verification
   */
  static async resetPasswordWithOtp(email: string, code: string, newPassword: string) {
    const otpRes = await pool.query(
      `SELECT * FROM otp_codes
       WHERE email = $1 AND code = $2 AND purpose = 'FORGOT_PASSWORD' AND expires_at > NOW()`,
      [email, code]
    );

    if (otpRes.rows.length === 0) {
      throw new Error('Kode OTP tidak valid atau telah kadaluwarsa.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    // Delete used OTP
    await pool.query(`DELETE FROM otp_codes WHERE email = $1 AND purpose = 'FORGOT_PASSWORD'`, [email]);

    return { message: 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.' };
  }

  /**
   * Request OTP for Change Password (Logged-in User)
   */
  static async requestChangePasswordOtp(userId: string) {
    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const email = userRes.rows[0].email;
    const otpExpiresInSeconds = 10 * 60;
    const otpCode = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + otpExpiresInSeconds * 1000);

    await pool.query('DELETE FROM otp_codes WHERE email = $1 AND purpose = $2', [email, 'FORGOT_PASSWORD']);
    await pool.query(
      `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'FORGOT_PASSWORD', $3)`,
      [email, otpCode, expiresAt]
    );

    await EmailService.sendOtpEmail(email, otpCode, 'FORGOT_PASSWORD');

    return {
      email,
      otp_expires_at: expiresAt.toISOString(),
      otp_expires_in_seconds: otpExpiresInSeconds,
      message: `Kode OTP ubah kata sandi telah dikirim ke email ${email}.`,
    };
  }

  /**
   * Change Password (Supports old password OR OTP verification)
   */
  static async changePassword(
    userId: string,
    params: { old_password?: string; otp_code?: string; new_password: string }
  ) {
    const { old_password, otp_code, new_password } = params;

    if (!new_password || new_password.length < 6) {
      throw new Error('Kata sandi baru minimal harus 6 karakter.');
    }

    const userRes = await pool.query('SELECT email, password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const user = userRes.rows[0];

    // Method 1: Using OTP code
    if (otp_code) {
      const otpRes = await pool.query(
        `SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()`,
        [user.email, otp_code]
      );
      if (otpRes.rows.length === 0) {
        throw new Error('Kode OTP tidak valid atau telah kadaluwarsa.');
      }
      await pool.query(`DELETE FROM otp_codes WHERE email = $1`, [user.email]);
    }
    // Method 2: Using Old Password
    else if (old_password) {
      const isMatch = await bcrypt.compare(old_password, user.password_hash);
      if (!isMatch) {
        throw new Error('Kata sandi lama yang Anda masukkan salah.');
      }
    } else {
      throw new Error('Silakan masukkan kata sandi lama Anda atau kode OTP verifikasi.');
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    return { message: 'Kata sandi Anda berhasil diperbarui.' };
  }

  /**
   * Refresh Token Endpoint
   */
  static async refreshAccessToken(refreshToken: string) {
    // 1. Check DB for refresh token
    const tokenRes = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenRes.rows.length === 0) {
      throw new Error('Refresh Token tidak valid atau telah kadaluwarsa.');
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, ENV.JWT.SECRET);
    } catch (e) {
      throw new Error('Refresh Token tidak sah.');
    }

    // Delete old refresh token & issue new pair
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    return await AuthService.generateTokenPair(payload.id, payload.email);
  }

  /**
   * Logout User (Blacklists Access Token & Revokes Refresh Token)
   */
  static async logout(accessToken: string | null, userId: string) {
    if (accessToken) {
      const cleanToken = accessToken.replace('Bearer ', '').trim();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours blacklist expiry

      await pool.query(
        `INSERT INTO jwt_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [cleanToken, expiresAt]
      );
    }

    // Delete refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

    return { message: 'Berhasil keluar akun. Token telah di-revoke.' };
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const cleanToken = token.replace('Bearer ', '').trim();
    const res = await pool.query('SELECT id FROM jwt_blacklist WHERE token = $1', [cleanToken]);
    return res.rows.length > 0;
  }

  /**
   * Helper: Generate Access Token (1h) & Refresh Token (7d)
   */
  private static async generateTokenPair(userId: string, email: string) {
    const accessToken = jwt.sign({ id: userId, email }, ENV.JWT.SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: userId, email, type: 'refresh' }, ENV.JWT.SECRET, { expiresIn: '7d' });

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, refreshToken, refreshExpiresAt]
    );

    return { accessToken, refreshToken };
  }

  static async getUserProfile(userId: string) {
    const userRes = await pool.query(
      `SELECT id, name, email, avatar_url, gender, birth_date::text AS birth_date, bio, created_at, is_verified FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) throw new Error('User not found');

    const settingsRes = await pool.query(
      `SELECT calculation_method, reminder_offset_minutes, notif_adzan_enabled, sticky_notif_enabled, language FROM user_settings WHERE user_id = $1`,
      [userId]
    );

    const postsCountRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM posts WHERE user_id = $1 AND deleted_at IS NULL`, [userId]);
    const todayStr = getLocalDateStr();
    const prayerLogRes = await pool.query(
      `SELECT COUNT(*)::INT AS count FROM prayer_log WHERE user_id = $1 AND (date = CURRENT_DATE OR date = $2::date) AND completed = true`,
      [userId, todayStr]
    );

    const savedMasjidsRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM masjid_bookmarks WHERE user_id = $1`, [userId]);
    const followersRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM follows WHERE following_id = $1`, [userId]);
    const followingRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM follows WHERE follower_id = $1`, [userId]);

    return {
      user: userRes.rows[0],
      settings: settingsRes.rows[0] || null,
      stats: {
        posts_count: postsCountRes.rows[0]?.count || 0,
        completed_prayers_today: prayerLogRes.rows[0]?.count || 0,
        saved_masjids_count: savedMasjidsRes.rows[0]?.count || 0,
        followers_count: followersRes.rows[0]?.count || 0,
        following_count: followingRes.rows[0]?.count || 0,
      },
    };
  }

  static async updateSettings(userId: string, settings: any) {
    const { calculation_method, reminder_offset_minutes, notif_adzan_enabled, sticky_notif_enabled, language } = settings;

    const res = await pool.query(
      `UPDATE user_settings
       SET calculation_method = COALESCE($1, calculation_method),
           reminder_offset_minutes = COALESCE($2, reminder_offset_minutes),
           notif_adzan_enabled = COALESCE($3, notif_adzan_enabled),
           sticky_notif_enabled = COALESCE($4, sticky_notif_enabled),
           language = COALESCE($5, language)
       WHERE user_id = $6
       RETURNING *`,
      [calculation_method, reminder_offset_minutes, notif_adzan_enabled, sticky_notif_enabled, language, userId]
    );

    return res.rows[0];
  }

  static async updateAvatar(userId: string, avatarUrl: string) {
    const res = await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, name, email, avatar_url, gender, birth_date::text AS birth_date, bio`,
      [avatarUrl, userId]
    );
    return res.rows[0];
  }

  static async updateProfile(userId: string, data: { name?: string; gender?: string; birth_date?: string; bio?: string }) {
    const { name, gender, birth_date, bio } = data;

    const res = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           gender = COALESCE($2, gender),
           birth_date = COALESCE($3, birth_date),
           bio = COALESCE($4, bio)
       WHERE id = $5
       RETURNING id, name, email, avatar_url, gender, birth_date::text AS birth_date, bio`,
      [name, gender, birth_date || null, bio, userId]
    );

    return res.rows[0];
  }

  static async getPublicUserProfile(targetUserId: string, currentUserId?: string | null) {
    const userRes = await pool.query(
      `SELECT id, name, avatar_url, gender, birth_date::text AS birth_date, bio, created_at FROM users WHERE id = $1`,
      [targetUserId]
    );
    if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan');

    const postsCountRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM posts WHERE user_id = $1 AND deleted_at IS NULL`, [targetUserId]);
    const followersRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM follows WHERE following_id = $1`, [targetUserId]);
    const followingRes = await pool.query(`SELECT COUNT(*)::INT AS count FROM follows WHERE follower_id = $1`, [targetUserId]);

    let isFollowing = false;
    if (currentUserId) {
      const followCheck = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, targetUserId]
      );
      isFollowing = followCheck.rows.length > 0;
    }

    const postsRes = await pool.query(
      `SELECT p.id, p.user_id, p.content, p.image_url, p.category, p.created_at,
              u.name AS author_name, u.avatar_url AS author_avatar,
              COUNT(DISTINCT pl.id)::INT AS likes_count,
              COUNT(DISTINCT pc.id)::INT AS comments_count,
              EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2) AS is_liked_by_me,
              EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = p.id AND user_id = $2) AS is_bookmarked_by_me,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object('id', pm.id, 'media_type', pm.media_type, 'url', pm.url)
                  ) 
                  FROM post_media pm 
                  WHERE pm.post_id = p.id
                ), 
                '[]'::json
              ) AS media_urls
       FROM posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN post_likes pl ON pl.post_id = p.id
       LEFT JOIN post_comments pc ON pc.post_id = p.id
       WHERE p.user_id = $1 AND p.deleted_at IS NULL
       GROUP BY p.id, u.id
       ORDER BY p.created_at DESC
       LIMIT 30`,
      [targetUserId, currentUserId || null]
    );

    return {
      user: {
        ...userRes.rows[0],
        is_following_by_me: isFollowing,
      },
      stats: {
        posts_count: postsCountRes.rows[0]?.count || 0,
        followers_count: followersRes.rows[0]?.count || 0,
        following_count: followingRes.rows[0]?.count || 0,
      },
      posts: postsRes.rows,
    };
  }

  static async toggleFollowUser(followerId: string, targetUserId: string) {
    if (followerId === targetUserId) {
      throw new Error('Anda tidak dapat mengikuti akun diri sendiri');
    }

    const targetUserCheck = await pool.query(`SELECT id FROM users WHERE id = $1`, [targetUserId]);
    if (targetUserCheck.rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan');
    }

    const existingFollow = await pool.query(
      `SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, targetUserId]
    );

    let isFollowing = false;
    if (existingFollow.rows.length > 0) {
      await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [
        followerId,
        targetUserId,
      ]);
      isFollowing = false;
    } else {
      await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
        [followerId, targetUserId]
      );
      isFollowing = true;

      // Trigger notification asynchronously
      (async () => {
        try {
          const followerRes = await pool.query('SELECT name FROM users WHERE id = $1', [followerId]);
          const followerName = followerRes.rows[0]?.name || 'Seseorang';
          await NotificationService.notifyUser({
            recipientId: targetUserId,
            actorId: followerId,
            type: 'FOLLOW_USER',
            title: 'Mulai Mengikuti Anda',
            body: `${followerName} sekarang mulai mengikuti Anda.`,
            entityType: 'USER',
            entityId: followerId,
          });
        } catch (err) {}
      })();
    }

    const followersCountRes = await pool.query(
      `SELECT COUNT(*)::INT AS count FROM follows WHERE following_id = $1`,
      [targetUserId]
    );

    return {
      is_following: isFollowing,
      followers_count: followersCountRes.rows[0]?.count || 0,
    };
  }

  static async getFollowersList(
    targetUserId: string,
    currentUserId?: string | null,
    limit = 20,
    offset = 0,
    search = ''
  ) {
    const params: any[] = [targetUserId, currentUserId || null];
    let searchCondition = '';

    if (search && search.trim()) {
      searchCondition = ` AND u.name ILIKE $3`;
      params.push(`%${search.trim()}%`);
      params.push(limit, offset);
      const res = await pool.query(
        `SELECT u.id, u.name, u.avatar_url, u.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following_by_me
         FROM follows f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = $1 ${searchCondition}
         ORDER BY f.created_at DESC
         LIMIT $4 OFFSET $5`,
        params
      );
      return res.rows;
    } else {
      params.push(limit, offset);
      const res = await pool.query(
        `SELECT u.id, u.name, u.avatar_url, u.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following_by_me
         FROM follows f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = $1
         ORDER BY f.created_at DESC
         LIMIT $3 OFFSET $4`,
        params
      );
      return res.rows;
    }
  }

  static async getFollowingList(
    targetUserId: string,
    currentUserId?: string | null,
    limit = 20,
    offset = 0,
    search = ''
  ) {
    const params: any[] = [targetUserId, currentUserId || null];
    let searchCondition = '';

    if (search && search.trim()) {
      searchCondition = ` AND u.name ILIKE $3`;
      params.push(`%${search.trim()}%`);
      params.push(limit, offset);
      const res = await pool.query(
        `SELECT u.id, u.name, u.avatar_url, u.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following_by_me
         FROM follows f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = $1 ${searchCondition}
         ORDER BY f.created_at DESC
         LIMIT $4 OFFSET $5`,
        params
      );
      return res.rows;
    } else {
      params.push(limit, offset);
      const res = await pool.query(
        `SELECT u.id, u.name, u.avatar_url, u.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) AS is_following_by_me
         FROM follows f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = $1
         ORDER BY f.created_at DESC
         LIMIT $3 OFFSET $4`,
        params
      );
      return res.rows;
    }
  }
}

