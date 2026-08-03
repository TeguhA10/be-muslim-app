import dns from 'dns';
import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { connectRedis } from './config/redis';

// Force Node.js DNS resolver to prioritize IPv4 addresses globally (fixes IPv6 ENETUNREACH on Node 18+)
dns.setDefaultResultOrder('ipv4first');
import { initSocket } from './config/socket';
import { initAdzanScheduler } from './schedulers/adzan.scheduler';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // 1. Connect Redis
    await connectRedis();

    // 2. Init Cron Job Scheduler
    initAdzanScheduler();

    // 3. Create HTTP Server & Init Socket.IO
    const server = http.createServer(app);
    initSocket(server);

    // 4. Start Listening
    server.listen(ENV.PORT, () => {
      logger.info(`[Server] Muslim App Backend API running on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
    });
  } catch (error: any) {
    logger.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
