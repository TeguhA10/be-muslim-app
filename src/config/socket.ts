import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    // Join user-specific notification room
    socket.on('join_user', (userId: string) => {
      if (userId) {
        socket.join(`user_${userId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} joined room user_${userId}`);
      }
    });

    socket.on('leave_user', (userId: string) => {
      if (userId) {
        socket.leave(`user_${userId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} left room user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  logger.info('[Socket.IO] Socket.IO server initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Send real-time notification to a specific user via WebSocket room
 */
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
    logger.info(`[Socket.IO] Emitted event '${event}' to room user_${userId}`);
  }
};

/**
 * Broadcast real-time notification to ALL connected users via WebSocket
 */
export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
    logger.info(`[Socket.IO] Broadcasted event '${event}' to all connected clients`);
  }
};
