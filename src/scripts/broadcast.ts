import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { pool } from '../config/database';

async function main() {
  const args = process.argv.slice(2);
  const title = args[0] || '📢 Pengumuman Penting';
  const body = args[1] || 'Selamat datang di aplikasi Muslim App! Nikmati fitur jadwal sholat, kajian, dan komunitas.';

  logger.info(`[Broadcast Script] Starting broadcast... Title: "${title}" | Body: "${body}"`);

  try {
    const result = await NotificationService.broadcastAnnouncement(title, body);
    logger.info(`[Broadcast Script] Successfully broadcasted to ${result.total} users (${result.pushSent} push notifications delivered to phone status bars).`);
  } catch (error: any) {
    logger.error(`[Broadcast Script] Failed: ${error.message}`);
  } finally {
    await pool.end();
  }
}

main();
