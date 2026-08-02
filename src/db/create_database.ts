import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';

async function setupDatabase() {
  console.log('[PostgreSQL] Connecting to default postgres database...');
  const rootClient = new Client({
    host: ENV.DB.HOST,
    port: ENV.DB.PORT,
    user: ENV.DB.USER,
    password: ENV.DB.PASSWORD,
    database: 'postgres',
  });

  try {
    await rootClient.connect();

    const res = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [ENV.DB.NAME]
    );

    if (res.rows.length === 0) {
      console.log(`[PostgreSQL] Creating database '${ENV.DB.NAME}'...`);
      await rootClient.query(`CREATE DATABASE "${ENV.DB.NAME}"`);
      console.log(`[PostgreSQL] Database '${ENV.DB.NAME}' created successfully!`);
    } else {
      console.log(`[PostgreSQL] Database '${ENV.DB.NAME}' already exists.`);
    }
  } catch (err: any) {
    console.error(`[PostgreSQL Error] ${err.message}`);
  } finally {
    await rootClient.end();
  }

  // Connect to target database and execute migrations & seeds
  console.log(`[PostgreSQL] Connecting to '${ENV.DB.NAME}'...`);
  const appClient = new Client({
    host: ENV.DB.HOST,
    port: ENV.DB.PORT,
    user: ENV.DB.USER,
    password: ENV.DB.PASSWORD,
    database: ENV.DB.NAME,
  });

  try {
    await appClient.connect();

    const migrationDir = path.join(__dirname, '../../db/migrations');
    if (fs.existsSync(migrationDir)) {
      const migrationFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
        await appClient.query(sql);
        console.log(`[PostgreSQL] Migration ${file} applied!`);
      }
    }

    const seedDir = path.join(__dirname, '../../db/seeds');
    if (fs.existsSync(seedDir)) {
      const seedFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.sql'));
      for (const file of seedFiles) {
        const seedSql = fs.readFileSync(path.join(seedDir, file), 'utf8');
        await appClient.query(seedSql);
        console.log(`[PostgreSQL] Seed ${file} applied!`);
      }
    }

    console.log('[SUCCESS] Database & Tables ready for DBeaver & Application!');
  } catch (err: any) {
    console.error(`[Migration Error] ${err.message}`);
  } finally {
    await appClient.end();
  }
}

setupDatabase();
