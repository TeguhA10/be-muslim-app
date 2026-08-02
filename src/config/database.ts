import { Pool } from 'pg';
import { ENV } from './env';

export const pool = new Pool({
  host: ENV.DB.HOST,
  port: ENV.DB.PORT,
  user: ENV.DB.USER,
  password: ENV.DB.PASSWORD,
  database: ENV.DB.NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log(`[Database] Connected to PostgreSQL: ${ENV.DB.NAME}`);
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected PostgreSQL error:', err);
});
