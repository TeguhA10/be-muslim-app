import { Pool } from 'pg';
import { ENV } from './env';

const isRemoteDb = ENV.DB.HOST !== 'localhost' && ENV.DB.HOST !== '127.0.0.1';

export const pool = new Pool({
  connectionString: ENV.DB.URL || undefined,
  host: ENV.DB.HOST,
  port: ENV.DB.PORT,
  user: ENV.DB.USER,
  password: ENV.DB.PASSWORD,
  database: ENV.DB.NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log(`[Database] Connected to PostgreSQL: ${ENV.DB.NAME} (${ENV.DB.HOST})`);
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected PostgreSQL error:', err);
});
