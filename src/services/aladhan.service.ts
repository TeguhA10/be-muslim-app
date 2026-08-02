import axios from 'axios';
import { ENV } from '../config/env';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

import { getLocalDateStr } from '../utils/date';

export class AladhanService {
  /**
   * Fetch daily prayer times by latitude and longitude.
   * Cached in Redis for 24 hours per location & date.
   */
  static async getPrayerTimes(latitude: number, longitude: number, method = 'KEMENAG', dateStr?: string) {
    const todayStr = dateStr || getLocalDateStr();
    const cacheKey = `prayer_times:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${method}:${todayStr}`;

    // 1. Try fetching from Redis cache
    try {
      if (redisClient.isOpen) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.info(`[AladhanService] Cache hit for ${cacheKey}`);
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      logger.warn('[AladhanService] Redis get error:', err);
    }

    // 2. Fetch from Aladhan API if not cached
    logger.info(`[AladhanService] Cache miss. Fetching from Aladhan API for lat=${latitude}, lng=${longitude}`);
    const methodIdMap: Record<string, number> = {
      KEMENAG: 20, // Kemenag Indonesia
      MWL: 3,      // Muslim World League
      ISNA: 2,     // Islamic Society of North America
      EGYPT: 5,    // Egyptian General Authority
      MAKKAH: 4,   // Umm al-Qura University, Makkah
    };

    const methodId = methodIdMap[method.toUpperCase()] || 20;

    const response = await axios.get(`${ENV.EXTERNAL_API.ALADHAN}/timings/${todayStr}`, {
      params: {
        latitude,
        longitude,
        method: methodId,
      },
    });

    const data = response.data?.data;

    // 3. Cache response in Redis for 24 hours (86400 seconds)
    try {
      if (redisClient.isOpen && data) {
        await redisClient.set(cacheKey, JSON.stringify(data), { EX: 86400 });
      }
    } catch (err) {
      logger.warn('[AladhanService] Redis set error:', err);
    }

    return data;
  }

  /**
   * Fetch Hijri Date details for given date
   */
  static async getHijriDate(dateStr?: string) {
    const today = dateStr || getLocalDateStr();
    const cacheKey = `hijri_date:${today}`;

    try {
      if (redisClient.isOpen) {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }
    } catch (err) {}

    const response = await axios.get(`${ENV.EXTERNAL_API.ALADHAN}/gregorianToHijri/${today}`);
    const data = response.data?.data;

    try {
      if (redisClient.isOpen && data) {
        await redisClient.set(cacheKey, JSON.stringify(data), { EX: 86400 });
      }
    } catch (err) {}

    return data;
  }
}
