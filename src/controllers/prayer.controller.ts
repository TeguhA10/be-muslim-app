import { Request, Response, NextFunction } from 'express';
import { AladhanService } from '../services/aladhan.service';
import { pool } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';

export class PrayerController {
  static async getPrayerTimes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng, method, date } = req.query;

      if (!lat || !lng) {
        sendError(res, 'Latitude (lat) and Longitude (lng) are required query parameters', null, 400);
        return;
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const calculationMethod = (method as string) || 'KEMENAG';
      const dateStr = date as string | undefined;

      const data = await AladhanService.getPrayerTimes(latitude, longitude, calculationMethod, dateStr);
      sendSuccess(res, 'Prayer times fetched successfully', data);
    } catch (error: any) {
      next(error);
    }
  }

  static async getHijriDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.query;
      const data = await AladhanService.getHijriDate(date as string | undefined);
      sendSuccess(res, 'Hijri date fetched successfully', data);
    } catch (error: any) {
      next(error);
    }
  }

  static async getIslamicEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await pool.query('SELECT * FROM islamic_events ORDER BY hijri_date ASC');
      sendSuccess(res, 'Islamic events fetched successfully', result.rows);
    } catch (error: any) {
      next(error);
    }
  }

  static async getPrayerLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const result = await pool.query(
        `SELECT prayer_name, completed FROM prayer_log WHERE user_id = $1 AND date = $2`,
        [userId, dateStr]
      );

      sendSuccess(res, 'Prayer logs fetched', result.rows);
    } catch (error: any) {
      next(error);
    }
  }

  static async getPrayerHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const days = parseInt((req.query.days as string) || '7', 10);

      const result = await pool.query(
        `SELECT date::text, COUNT(*) FILTER (WHERE completed = true)::INT AS completed_count
         FROM prayer_log
         WHERE user_id = $1 AND date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
         GROUP BY date
         HAVING COUNT(*) FILTER (WHERE completed = true) >= 0
         ORDER BY date DESC`,
        [userId, days]
      );

      sendSuccess(res, 'Prayer history fetched', result.rows);
    } catch (error: any) {
      next(error);
    }
  }

  static async logPrayer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const { prayer_name, date, completed } = req.body;

      if (!prayer_name || !date) {
        sendError(res, 'prayer_name, date, and completed status are required', null, 400);
        return;
      }

      const result = await pool.query(
        `INSERT INTO prayer_log (user_id, prayer_name, date, completed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, prayer_name, date)
         DO UPDATE SET completed = EXCLUDED.completed
         RETURNING *`,
        [userId, prayer_name, date, completed ?? true]
      );

      sendSuccess(res, 'Prayer log recorded', result.rows[0]);
    } catch (error: any) {
      next(error);
    }
  }
}
