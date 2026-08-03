import { createClient } from 'redis';
import { ENV } from './env';

// Strip protocol prefix (https://, http://, rediss://, redis://) and trailing slashes
const rawHost = ENV.REDIS.HOST || 'localhost';
const cleanHost = rawHost.replace(/^(https?:\/\/|rediss?:\/\/)/i, '').replace(/\/.*$/, '').trim();
const isCloudRedis = cleanHost !== 'localhost' && cleanHost !== '127.0.0.1';

export const redisClient = createClient({
  socket: {
    host: cleanHost,
    port: ENV.REDIS.PORT || 6379,
    tls: isCloudRedis ? true : undefined,
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
