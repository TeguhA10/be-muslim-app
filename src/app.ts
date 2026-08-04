import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { sanitizeInputs } from './middlewares/sanitizer.middleware';

import { ENV } from './config/env';

const app: Express = express();

// 0. Enable Trust Proxy for Reverse Proxies / Load Balancers (Render, Cloudflare, Nginx)
app.set('trust proxy', 1);

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

import { globalLimiter } from './middlewares/rateLimiter.middleware';

// 3. Global Rate Limiter
app.use(globalLimiter);

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
