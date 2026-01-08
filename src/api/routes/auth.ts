/**
 * 認証 API ルート
 */

import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import crypto from 'crypto';
import {
  createUser,
  getUserByUsername,
  getUserById,
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokensForUser,
  cleanupExpiredRefreshTokens,
} from '../../utils/database.js';
import {
  generateTokenPair,
  verifyToken,
  getRefreshTokenExpiry,
  authMiddleware,
  AuthenticatedRequest,
} from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register - ユーザー登録
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;

    // バリデーション
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required', code: 'VALIDATION_ERROR' });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: 'Username must be 3-50 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    if (password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    // 既存ユーザーチェック
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      res.status(409).json({ error: 'Username already exists', code: 'USER_EXISTS' });
      return;
    }

    // パスワードハッシュ化
    const passwordHash = await argon2.hash(password);

    // ユーザー作成
    const userRole = role === 'admin' ? 'admin' : 'user';
    const userId = createUser(username, passwordHash, userRole);

    // トークン生成
    const tokens = generateTokenPair({ userId, username, role: userRole });

    // リフレッシュトークン保存
    const expiresAt = getRefreshTokenExpiry();
    saveRefreshToken(userId, tokens.refreshToken, expiresAt.toISOString());

    res.status(201).json({
      user: { id: userId, username, role: userRole },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/login - ログイン
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // バリデーション
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required', code: 'VALIDATION_ERROR' });
      return;
    }

    // ユーザー検索
    const user = getUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    // パスワード検証
    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    // トークン生成
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // リフレッシュトークン保存
    const expiresAt = getRefreshTokenExpiry();
    saveRefreshToken(user.id, tokens.refreshToken, expiresAt.toISOString(), undefined, undefined, 'login');

    // 期限切れトークンをクリーンアップ
    cleanupExpiredRefreshTokens();

    res.json({
      user: { id: user.id, username: user.username, role: user.role },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/refresh - トークンリフレッシュ
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // トークン検証
    const payload = verifyToken(refreshToken);
    if (!payload) {
      res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
      return;
    }

    // DBに保存されているか確認
    const storedToken = getRefreshToken(refreshToken);
    if (!storedToken) {
      res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
      return;
    }

    // 有効期限チェック
    if (new Date() > new Date(storedToken.expires_at)) {
      deleteRefreshToken(refreshToken);
      res.status(401).json({ error: 'Refresh token expired', code: 'TOKEN_EXPIRED' });
      return;
    }

    // ユーザー存在チェック
    const user = getUserById(payload.userId);
    if (!user) {
      deleteRefreshToken(refreshToken);
      res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    // 古いトークンを削除
    deleteRefreshToken(refreshToken);

    // 新しいトークンペアを生成
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 新しいリフレッシュトークンを保存
    const expiresAt = getRefreshTokenExpiry();
    saveRefreshToken(user.id, tokens.refreshToken, expiresAt.toISOString(), undefined, undefined, 'refresh');

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/logout - ログアウト
 */
router.post('/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      deleteRefreshToken(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/auth/me - 現在のユーザー情報
 */
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    const user = getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user', code: 'INTERNAL_ERROR' });
  }
});

export default router;
