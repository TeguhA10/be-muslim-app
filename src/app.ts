import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { sanitizeInputs } from './middlewares/sanitizer.middleware';

import { ENV } from './config/env';

const app: Express = express();

// 1. Hardened Security Headers (OWASP Security Standards)
app.use(
  helmet({
    contentSecurityPolicy: false, // Mobile API backend
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// 2. Strict CORS Configuration
const allowedOrigins = (ENV.SECURITY.CORS_ORIGIN || '*').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Access blocked by CORS Policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Tiered Rate Limiters (OWASP API4:2023 Unrestricted Resource Consumption Protection)
const globalLimiter = rateLimit({
  windowMs: ENV.SECURITY.RATE_LIMIT.GLOBAL_WINDOW_MS,
  max: ENV.SECURITY.RATE_LIMIT.GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan dari IP ini, silakan coba beberapa saat lagi.' },
});

const authLimiter = rateLimit({
  windowMs: ENV.SECURITY.RATE_LIMIT.AUTH_WINDOW_MS,
  max: ENV.SECURITY.RATE_LIMIT.AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Batas percobaan login/OTP terlampaui. Silakan coba lagi dalam beberapa saat.' },
});

app.use(globalLimiter);
app.use('/api/v1/auth', authLimiter);

// 4. Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Input Sanitizer (XSS Attack Guard)
app.use(sanitizeInputs);

// 6. Health Check Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Muslim Application API is running safely', timestamp: new Date().toISOString() });
});

// 7. API v1 Routes
app.use('/api/v1', routes);

// 8. Global Error Handler
app.use(errorHandler);

export default app;
