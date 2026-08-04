import rateLimit from 'express-rate-limit';
import { ENV } from '../config/env';

export const globalLimiter = rateLimit({
  windowMs: ENV.SECURITY.RATE_LIMIT.GLOBAL_WINDOW_MS,
  max: ENV.SECURITY.RATE_LIMIT.GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan dari IP ini, silakan coba beberapa saat lagi.' },
});

export const authLimiter = rateLimit({
  windowMs: ENV.SECURITY.RATE_LIMIT.AUTH_WINDOW_MS,
  max: ENV.SECURITY.RATE_LIMIT.AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Batas percobaan login/OTP terlampaui. Silakan coba lagi dalam beberapa saat.' },
});
