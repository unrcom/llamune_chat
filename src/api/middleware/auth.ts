/**
 * JWT 認証ユーティリティ
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// 環境変数から設定を取得
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * トークンペイロードの型
 */
export interface TokenPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
}

/**
 * 認証済みリクエストの型
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * アクセストークンを生成
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

/**
 * リフレッシュトークンを生成
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}

/**
 * トークンペアを生成
 */
export function generateTokenPair(payload: TokenPayload): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * トークンを検証
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * リフレッシュトークンの有効期限を取得
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = JWT_REFRESH_EXPIRY;
  const now = new Date();
  
  if (expiry.endsWith('d')) {
    const days = parseInt(expiry.slice(0, -1));
    now.setDate(now.getDate() + days);
  } else if (expiry.endsWith('h')) {
    const hours = parseInt(expiry.slice(0, -1));
    now.setHours(now.getHours() + hours);
  } else if (expiry.endsWith('m')) {
    const minutes = parseInt(expiry.slice(0, -1));
    now.setMinutes(now.getMinutes() + minutes);
  }
  
  return now;
}

/**
 * 認証ミドルウェア
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    return;
  }
  
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    return;
  }
  
  req.user = payload;
  next();
}

/**
 * オプショナル認証ミドルウェア（トークンがあれば検証、なくても通過）
 */
export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}
