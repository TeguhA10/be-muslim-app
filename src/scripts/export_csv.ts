import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  if (val instanceof Date) return `"${val.toISOString()}"`;
  if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

const exportAllTablesToCsv = async () => {
  logger.info('[CSV Exporter] Fetching list of tables from PostgreSQL database...');
  try {
    const exportDir = path.join(__dirname, '../../exports/csv');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Get list of tables in public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    logger.info(`[CSV Exporter] Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    for (const tableName of tableNames) {
      const queryRes = await pool.query(`SELECT * FROM "${tableName}"`);
      const rows = queryRes.rows;

      if (rows.length === 0) {
        // Get column names even if table is empty
        const colRes = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position ASC
        `, [tableName]);
        const headers = colRes.rows.map(c => `"${c.column_name}"`).join(',');
        const filePath = path.join(exportDir, `${tableName}.csv`);
        fs.writeFileSync(filePath, headers + '\n', 'utf8');
        logger.info(`[CSV Exporter] Exported empty table schema: ${tableName}.csv`);
        continue;
      }

      const headers = Object.keys(rows[0]).map(h => `"${h}"`).join(',');
      const csvLines = [headers];

      for (const row of rows) {
        const line = Object.values(row).map(escapeCsvCell).join(',');
        csvLines.push(line);
      }

      const filePath = path.join(exportDir, `${tableName}.csv`);
      fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8');
      logger.info(`[CSV Exporter] Exported ${rows.length} rows to ${tableName}.csv`);
    }

    logger.info(`[CSV Exporter] All database tables successfully exported to CSV at: ${exportDir}`);
  } catch (error: any) {
    logger.error(`[CSV Exporter] Error exporting database: ${error.message}`);
  } finally {
    await pool.end();
  }
};

exportAllTablesToCsv();
