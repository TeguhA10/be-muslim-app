import { Request, Response, NextFunction } from 'express';
import { OverpassService } from '../services/overpass.service';
import { pool } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { CloudinaryService } from '../services/cloudinary.service';

export class MasjidController {
  static async getNearbyMasjids(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng, radius } = req.query;
      const userId = req.user?.id;

      if (!lat || !lng) {
        sendError(res, 'Latitude (lat) and Longitude (lng) are required', null, 400);
        return;
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusMeters = radius ? parseInt(radius as string, 10) : 10000;

      const mosques = await OverpassService.getNearbyMosques(latitude, longitude, radiusMeters, userId);
      sendSuccess(res, 'Nearby masjids fetched successfully', mosques);
    } catch (error: any) {
      next(error);
    }
  }

  static async toggleBookmark(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const masjidIdParam = req.params.id as string;
      const { name, latitude, longitude, address } = req.body;

      let targetMasjidId: string | null = null;

      // 1. Check if masjidIdParam is a valid UUID and exists in DB
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(masjidIdParam)) {
        const existing = await pool.query('SELECT id FROM masjid WHERE id = $1', [masjidIdParam]);
        if (existing.rows.length > 0) {
          targetMasjidId = existing.rows[0].id;
        }
      }

      // 2. If not found by UUID, find or insert by name & coordinates
      if (!targetMasjidId) {
        const masjidName = name || 'Masjid';
        const latVal = latitude ? parseFloat(latitude) : -6.200000;
        const lngVal = longitude ? parseFloat(longitude) : 106.816666;
        const addrVal = address || 'Alamat lokasi';

        const found = await pool.query(
          'SELECT id FROM masjid WHERE name = $1 AND abs(latitude - $2) < 0.001 AND abs(longitude - $3) < 0.001',
          [masjidName, latVal, lngVal]
        );

        if (found.rows.length > 0) {
          targetMasjidId = found.rows[0].id;
        } else {
          const inserted = await pool.query(
            `INSERT INTO masjid (name, latitude, longitude, address)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [masjidName, latVal, lngVal, addrVal]
          );
          targetMasjidId = inserted.rows[0].id;
        }
      }

      // 3. Toggle in masjid_bookmarks table
      const bookmarkCheck = await pool.query(
        'SELECT id FROM masjid_bookmarks WHERE masjid_id = $1 AND user_id = $2',
        [targetMasjidId, userId]
      );

      if (bookmarkCheck.rows.length > 0) {
        await pool.query('DELETE FROM masjid_bookmarks WHERE masjid_id = $1 AND user_id = $2', [
          targetMasjidId,
          userId,
        ]);
        sendSuccess(res, 'Masjid removed from bookmarks', { bookmarked: false, masjid_id: targetMasjidId });
      } else {
        await pool.query('INSERT INTO masjid_bookmarks (masjid_id, user_id) VALUES ($1, $2)', [
          targetMasjidId,
          userId,
        ]);
        sendSuccess(res, 'Masjid saved to bookmarks', { bookmarked: true, masjid_id: targetMasjidId });
      }
    } catch (error: any) {
      next(error);
    }
  }

  static async getBookmarks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const result = await pool.query(
        `SELECT m.id, m.name, m.latitude, m.longitude, m.address, true AS is_bookmarked_by_me,
                COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM masjid_reviews WHERE masjid_id = m.id), 4.8) AS average_rating,
                COALESCE((SELECT COUNT(*) FROM masjid_reviews WHERE masjid_id = m.id), 0) AS total_reviews
         FROM masjid_bookmarks mb
         JOIN masjid m ON m.id = mb.masjid_id
         WHERE mb.user_id = $1
         ORDER BY mb.created_at DESC`,
        [userId]
      );

      sendSuccess(res, 'Saved masjids fetched successfully', result.rows);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Create or Update (UPSERT) user review for a masjid + upload photos to Cloudinary & masjid_review_photos table.
   */
  static async addOrUpdateReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized access', null, 401);
        return;
      }

      const masjidIdParam = req.params.id || req.body.masjid_id;
      const { rating, comment, name, latitude, longitude, address } = req.body;
      const ratingNum = parseInt(rating, 10);

      if (!masjidIdParam || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        sendError(res, 'masjid_id and valid rating (1-5) are required', null, 400);
        return;
      }

      // Ensure target masjid exists in DB
      let targetMasjidId: string | null = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(masjidIdParam)) {
        const existing = await pool.query('SELECT id FROM masjid WHERE id = $1', [masjidIdParam]);
        if (existing.rows.length > 0) {
          targetMasjidId = existing.rows[0].id;
        }
      }

      if (!targetMasjidId) {
        const masjidName = name || 'Masjid';
        const latVal = latitude ? parseFloat(latitude) : -6.200000;
        const lngVal = longitude ? parseFloat(longitude) : 106.816666;
        const addrVal = address || 'Alamat lokasi';

        const found = await pool.query(
          'SELECT id FROM masjid WHERE name = $1 AND abs(latitude - $2) < 0.001 AND abs(longitude - $3) < 0.001',
          [masjidName, latVal, lngVal]
        );

        if (found.rows.length > 0) {
          targetMasjidId = found.rows[0].id;
        } else {
          const inserted = await pool.query(
            `INSERT INTO masjid (name, latitude, longitude, address)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [masjidName, latVal, lngVal, addrVal]
          );
          targetMasjidId = inserted.rows[0].id;
        }
      }

      // Upsert Review into masjid_reviews
      const reviewRes = await pool.query(
        `INSERT INTO masjid_reviews (masjid_id, user_id, rating, comment, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (masjid_id, user_id)
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [targetMasjidId, userId, ratingNum, comment || null]
      );

      const review = reviewRes.rows[0];

      // Handle photo uploads if files provided
      const photoUrls: string[] = [];
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        // Upload images to Cloudinary concurrently
        const uploadPromises = files.map((file) => CloudinaryService.uploadImage(file.buffer));
        const uploaded = await Promise.all(uploadPromises);
        photoUrls.push(...uploaded);

        // Delete old photos for this review in separate table
        await pool.query('DELETE FROM masjid_review_photos WHERE review_id = $1', [review.id]);

        // Insert new photo URLs into masjid_review_photos table
        for (const pUrl of photoUrls) {
          await pool.query(
            'INSERT INTO masjid_review_photos (review_id, photo_url) VALUES ($1, $2)',
            [review.id, pUrl]
          );
        }
      } else {
        // Fetch existing photos from masjid_review_photos table
        const pRes = await pool.query(
          'SELECT photo_url FROM masjid_review_photos WHERE review_id = $1 ORDER BY created_at ASC',
          [review.id]
        );
        photoUrls.push(...pRes.rows.map((r) => r.photo_url));
      }

      sendSuccess(res, 'Review submitted successfully', {
        ...review,
        photos: photoUrls,
      }, 200);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get rating summary & user's own review for a masjid
   */
  static async getReviewSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const masjidId = req.params.id as string;
      const userId = req.user?.id;

      // Calculate aggregate rating metrics
      const aggResult = await pool.query(
        `SELECT
            COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average_rating,
            COUNT(*)::int AS total_reviews,
            COUNT(*) FILTER (WHERE rating = 5)::int AS star_5,
            COUNT(*) FILTER (WHERE rating = 4)::int AS star_4,
            COUNT(*) FILTER (WHERE rating = 3)::int AS star_3,
            COUNT(*) FILTER (WHERE rating = 2)::int AS star_2,
            COUNT(*) FILTER (WHERE rating = 1)::int AS star_1
         FROM masjid_reviews
         WHERE masjid_id = $1`,
        [masjidId]
      );

      const stats = aggResult.rows[0] || {
        average_rating: 0,
        total_reviews: 0,
        star_5: 0,
        star_4: 0,
        star_3: 0,
        star_2: 0,
        star_1: 0,
      };

      // Fetch user's own review if logged in
      let myReview = null;
      if (userId) {
        const myRes = await pool.query(
          `SELECT mr.id, mr.rating, mr.comment, mr.created_at, mr.updated_at,
                  COALESCE(json_agg(mrp.photo_url) FILTER (WHERE mrp.photo_url IS NOT NULL), '[]') AS photos
           FROM masjid_reviews mr
           LEFT JOIN masjid_review_photos mrp ON mrp.review_id = mr.id
           WHERE mr.masjid_id = $1 AND mr.user_id = $2
           GROUP BY mr.id`,
          [masjidId, userId]
        );
        if (myRes.rows.length > 0) {
          myReview = myRes.rows[0];
        }
      }

      sendSuccess(res, 'Review summary fetched successfully', {
        average_rating: parseFloat(stats.average_rating) || 0,
        total_reviews: parseInt(stats.total_reviews, 10) || 0,
        star_distribution: {
          5: parseInt(stats.star_5, 10) || 0,
          4: parseInt(stats.star_4, 10) || 0,
          3: parseInt(stats.star_3, 10) || 0,
          2: parseInt(stats.star_2, 10) || 0,
          1: parseInt(stats.star_1, 10) || 0,
        },
        my_review: myReview,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Get list of all reviews for a masjid with user details & photos
   */
  static async getReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const masjidId = req.params.id as string;
      const userId = req.user?.id;
      const { rating, has_photo } = req.query;

      let whereClause = 'WHERE mr.masjid_id = $1';
      const params: any[] = [masjidId, userId || null];
      let paramIdx = 3;

      if (rating) {
        const ratingNum = parseInt(rating as string, 10);
        if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
          whereClause += ` AND mr.rating = $${paramIdx}`;
          params.push(ratingNum);
          paramIdx++;
        }
      }

      let havingClause = '';
      if (has_photo === 'true') {
        havingClause = 'HAVING COUNT(mrp.id) > 0';
      }

      const query = `
        SELECT mr.id, mr.masjid_id, mr.user_id, mr.rating, mr.comment, mr.created_at, mr.updated_at,
               u.name AS user_name, u.avatar_url AS user_avatar,
               (mr.user_id = $2) AS is_mine,
               COALESCE(json_agg(mrp.photo_url) FILTER (WHERE mrp.photo_url IS NOT NULL), '[]') AS photos
        FROM masjid_reviews mr
        JOIN users u ON u.id = mr.user_id
        LEFT JOIN masjid_review_photos mrp ON mrp.review_id = mr.id
        ${whereClause}
        GROUP BY mr.id, u.id
        ${havingClause}
        ORDER BY mr.created_at DESC
      `;

      const result = await pool.query(query, params);
      sendSuccess(res, 'Reviews fetched successfully', result.rows);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Delete user's own review
   */
  static async deleteReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const reviewId = req.params.reviewId as string;

      if (!userId) {
        sendError(res, 'Unauthorized', null, 401);
        return;
      }

      const check = await pool.query('SELECT user_id FROM masjid_reviews WHERE id = $1', [reviewId]);
      if (check.rows.length === 0) {
        sendError(res, 'Review not found', null, 404);
        return;
      }

      if (check.rows[0].user_id !== userId) {
        sendError(res, 'You can only delete your own review', null, 403);
        return;
      }

      await pool.query('DELETE FROM masjid_reviews WHERE id = $1', [reviewId]);
      sendSuccess(res, 'Review deleted successfully', { deleted: true });
    } catch (error: any) {
      next(error);
    }
  }
}

