import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[ErrorHandler] ${req.method} ${req.path} - ${err.message}`, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const errorPayload =
    err.details ||
    (process.env.NODE_ENV === 'development'
      ? err.stack
      : undefined);

  return sendError(res, message, errorPayload, statusCode);
};
