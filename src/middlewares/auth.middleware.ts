import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { sendError } from '../utils/response';
import { AuthService } from '../services/auth.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  token?: string;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Access token is required. Silakan masuk atau daftar terlebih dahulu.', null, 401);
  }

  // Check JWT Blacklist
  try {
    const isBlacklisted = await AuthService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return sendError(res, 'Token telah di-revoke / logout. Silakan masuk kembali.', null, 401);
    }

    const decoded = jwt.verify(token, ENV.JWT.SECRET) as { id: string; email: string };
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    return sendError(res, 'Token tidak sah atau telah kadaluwarsa. Silakan masuk kembali.', null, 401);
  }
};

/**
 * Middleware opsional: jika token ada & valid, isi req.user.
 * Jika tidak ada token (guest), lanjut tanpa error dan req.user = undefined.
 */
export const optionalAuthenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const isBlacklisted = await AuthService.isTokenBlacklisted(token);
    if (!isBlacklisted) {
      const decoded = jwt.verify(token, ENV.JWT.SECRET) as { id: string; email: string };
      req.user = decoded;
      req.token = token;
    } else {
      req.user = undefined;
    }
  } catch {
    req.user = undefined;
  }

  return next();
};
