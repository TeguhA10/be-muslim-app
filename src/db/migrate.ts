import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const runMigrations = async () => {
  logger.info('[Migration] Starting database migration for muslim_database_app...');
  try {
    const migrationDir = path.join(__dirname, '../../db/migrations');
    if (fs.existsSync(migrationDir)) {
      const migrationFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
        await pool.query(sql);
        logger.info(`[Migration] Migration ${file} applied successfully!`);
      }
    }

    const seedDir = path.join(__dirname, '../../db/seeds');
    if (fs.existsSync(seedDir)) {
      const seedFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of seedFiles) {
        const seedSql = fs.readFileSync(path.join(seedDir, file), 'utf8');
        await pool.query(seedSql);
        logger.info(`[Migration] Seed ${file} inserted successfully!`);
      }
    }
  } catch (error: any) {
    logger.error(`[Migration] Migration error: ${error.message}`);
  } finally {
    await pool.end();
  }
};

runMigrations();
