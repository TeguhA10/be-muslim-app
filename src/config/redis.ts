import { createClient } from 'redis';
import { ENV } from './env';

export const redisClient = createClient({
  socket: {
    host: ENV.REDIS.HOST,
    port: ENV.REDIS.PORT,
  },
  password: ENV.REDIS.PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  console.warn('[Redis] Redis error or not connected:', err.message);
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected to Redis Cache');
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('[Redis] Failed to connect to Redis. Fallback to direct DB/API calls.');
  }
};
