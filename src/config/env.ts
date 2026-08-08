import dotenv from 'dotenv';
import path from 'path';

const envMode = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${envMode}`) });
dotenv.config(); // fallback to default .env

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT || '5432', 10),
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'postgres',
    NAME: process.env.DB_NAME || 'muslim_database_app',
    URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/muslim_database_app',
  },
  REDIS: {
    HOST: process.env.REDIS_HOST || 'localhost',
    PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    PASSWORD: process.env.REDIS_PASSWORD || '',
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'default_jwt_secret',
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default_jwt_refresh_secret',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  EXTERNAL_API: {
    ALADHAN: process.env.ALADHAN_API_BASE_URL || 'https://api.aladhan.com/v1',
    OVERPASS: process.env.OVERPASS_API_BASE_URL || 'https://overpass-api.de/api/interpreter',
  },
  EMAIL: {
    BREVO_API_KEY: process.env.BREVO_API_KEY || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    HOST: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
    PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
    SECURE: process.env.EMAIL_SECURE === 'true',
    USER: process.env.EMAIL_USER || '',
    PASS: process.env.EMAIL_PASS || '',
    FROM_NAME: process.env.EMAIL_FROM_NAME || 'Muslim App',
    FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'alfaruqiteguh@gmail.com',
  },
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'duzkwgevq',
    API_KEY: process.env.CLOUDINARY_API_KEY || '395813582699366',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '7s8OZTPIrfzMeMRe4mPQfEyuFjA',
  },
  SECURITY: {
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    RATE_LIMIT: {
      GLOBAL_WINDOW_MS: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '900000', 10), // 15 mins default
      GLOBAL_MAX: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '1000', 10), // 1,000 requests per 15 mins
      AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10), // 15 mins default
      AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '30', 10), // 30 auth attempts per 15 mins
    },
  },
};
