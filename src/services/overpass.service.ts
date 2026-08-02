import axios from 'axios';
import { ENV } from '../config/env';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

// Helper Haversine Distance Formula in Kilometers
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.ai/api/interpreter',
  ENV.EXTERNAL_API.OVERPASS,
];

export class OverpassService {
  /**
  /**
   * Fast nearby mosque search with multi-tier caching (Redis -> PostgreSQL Local DB -> Overpass API).
   */
  static async getNearbyMosques(latitude: number, longitude: number, radiusMeters = 5000, userId?: string) {
    const gridLat = latitude.toFixed(2);
    const gridLng = longitude.toFixed(2);
    const cacheKey = `nearby_mosques:${gridLat}:${gridLng}`;

    // Get user's bookmarked set and ratings map live from PostgreSQL
    const bookmarkedSet = new Set<string>();
    const ratingsMap = new Map<string, { rating: number; count: number }>();

    try {
      if (userId) {
        const bRes = await pool.query(
          `SELECT m.id, m.latitude, m.longitude FROM masjid_bookmarks mb JOIN masjid m ON m.id = mb.masjid_id WHERE mb.user_id = $1`,
          [userId]
        );
        bRes.rows.forEach((row) => {
          bookmarkedSet.add(row.id);
          if (row.latitude && row.longitude) {
            const coordKey = `${parseFloat(row.latitude).toFixed(4)}_${parseFloat(row.longitude).toFixed(4)}`;
            bookmarkedSet.add(coordKey);
          }
        });
      }

      const rRes = await pool.query(
        `SELECT m.id, m.latitude, m.longitude,
                ROUND(AVG(mr.rating)::numeric, 1) AS average_rating,
                COUNT(mr.id)::int AS total_reviews
         FROM masjid m
         JOIN masjid_reviews mr ON mr.masjid_id = m.id
         GROUP BY m.id, m.latitude, m.longitude`
      );
      rRes.rows.forEach((row) => {
        const data = {
          rating: parseFloat(row.average_rating) || 4.8,
          count: parseInt(row.total_reviews, 10) || 0,
        };
        ratingsMap.set(row.id, data);
        if (row.latitude && row.longitude) {
          const coordKey = `${parseFloat(row.latitude).toFixed(4)}_${parseFloat(row.longitude).toFixed(4)}`;
          ratingsMap.set(coordKey, data);
        }
      });
    } catch (e) {}

    const attachLiveData = (m: any) => {
      const latVal = parseFloat(m.latitude);
      const lngVal = parseFloat(m.longitude);
      const coordKey = !isNaN(latVal) && !isNaN(lngVal) ? `${latVal.toFixed(4)}_${lngVal.toFixed(4)}` : '';

      const ratingInfo = ratingsMap.get(m.id) || (coordKey ? ratingsMap.get(coordKey) : undefined);
      return {
        ...m,
        average_rating: ratingInfo ? ratingInfo.rating : (parseFloat(m.average_rating) || 4.8),
        total_reviews: ratingInfo ? ratingInfo.count : (parseInt(m.total_reviews, 10) || 0),
        is_bookmarked_by_me: bookmarkedSet.has(m.id) || (coordKey ? bookmarkedSet.has(coordKey) : false),
      };
    };

    // Tier 1: Redis Cache (< 5ms)
    try {
      if (redisClient.isOpen) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.info(`[OverpassService] Redis hit for ${cacheKey}`);
          const mosques = JSON.parse(cached);
          return mosques.map(attachLiveData);
        }
      }
    } catch (err) {}

    // Tier 2: PostgreSQL Local DB (< 15ms)
    try {
      const dbResult = await pool.query(
        `SELECT m.id, m.name, m.latitude, m.longitude, m.address,
                (6371 * acos(cos(radians($1)) * cos(radians(m.latitude)) * cos(radians(m.longitude) - radians($2)) + sin(radians($1)) * sin(radians(m.latitude))))::numeric(10,2) AS distance_km
         FROM masjid m
         WHERE (6371 * acos(cos(radians($1)) * cos(radians(m.latitude)) * cos(radians(m.longitude) - radians($2)) + sin(radians($1)) * sin(radians(m.latitude)))) <= 15
         ORDER BY distance_km ASC
         LIMIT 25`,
        [latitude, longitude]
      );

      if (dbResult.rows && dbResult.rows.length >= 3) {
        logger.info(`[OverpassService] Local DB hit (${dbResult.rows.length} masjids)`);
        const mosques = dbResult.rows.map((m: any) => ({
          ...m,
          latitude: parseFloat(m.latitude),
          longitude: parseFloat(m.longitude),
          distance_km: parseFloat(m.distance_km),
        }));

        // Cache in Redis asynchronously
        if (redisClient.isOpen) {
          redisClient.set(cacheKey, JSON.stringify(mosques), { EX: 21600 }).catch(() => {});
        }

        return mosques.map(attachLiveData);
      }
    } catch (dbErr) {}

    // Tier 3: Fast Overpass API Query
    const queryRadius = Math.min(radiusMeters, 5000); // limit to 5km for fast response
    const overpassQuery = `
      [out:json][timeout:5];
      (
        node["amenity"="place_of_worship"]["religion"="muslim"](around:${queryRadius},${latitude},${longitude});
        way["amenity"="place_of_worship"]["religion"="muslim"](around:${queryRadius},${latitude},${longitude});
      );
      out center 25;
    `;

    let responseData: any[] = [];
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await axios.post(endpoint, `data=${encodeURIComponent(overpassQuery)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 4000,
        });

        if (res.data?.elements && res.data.elements.length > 0) {
          responseData = res.data.elements;
          break;
        }
      } catch (err) {}
    }

    let mosques: any[] = [];
    if (responseData.length > 0) {
      mosques = responseData
        .map((elem: any) => {
          const lat = parseFloat(elem.lat || elem.center?.lat);
          const lng = parseFloat(elem.lon || elem.center?.lon);
          const name = elem.tags?.name || elem.tags?.['name:en'] || elem.tags?.['name:id'] || 'Masjid';
          const street = elem.tags?.['addr:street'] || '';
          const city = elem.tags?.['addr:city'] || elem.tags?.['addr:suburb'] || '';
          const address = [street, city].filter(Boolean).join(', ') || 'Lokasi sekitar';

          if (isNaN(lat) || isNaN(lng)) return null;
          const distance_km = calculateHaversineDistance(latitude, longitude, lat, lng);

          return {
            id: `osm_${elem.id}`,
            osm_id: elem.id,
            name,
            latitude: lat,
            longitude: lng,
            address,
            distance_km,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance_km - b.distance_km);

      // Async persist fetched mosques into local PostgreSQL database for instant subsequent hits
      for (const m of mosques) {
        pool.query(
          `INSERT INTO masjid (name, latitude, longitude, address)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [m.name, m.latitude, m.longitude, m.address]
        ).catch(() => {});
      }

      // Cache in Redis for 6 hours
      if (redisClient.isOpen && mosques.length > 0) {
        redisClient.set(cacheKey, JSON.stringify(mosques), { EX: 21600 }).catch(() => {});
      }
    }

    return mosques.map(attachLiveData);
  }
}
