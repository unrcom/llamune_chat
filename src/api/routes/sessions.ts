/**
 * セッション API ルート
 */

import { Router, Response } from 'express';
import {
  createSession,
  listSessions,
  getSession,
  updateSessionTitle,
  deleteSession,
} from '../../utils/database.js';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/sessions - セッション一覧取得
 */
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    const sessions = listSessions(limit, req.user?.userId);
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/sessions - セッション作成
 */
router.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { model, modeId, projectPath } = req.body;

    // バリデーション
    if (!model) {
      res.status(400).json({ error: 'Model is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const sessionId = createSession(model, req.user?.userId, modeId, projectPath);

    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(500).json({ error: 'Failed to create session', code: 'INTERNAL_ERROR' });
      return;
    }

    res.status(201).json({
      session: sessionData.session,
      systemPrompt: sessionData.systemPrompt,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/sessions/:id - セッション取得
 */
router.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
      return;
    }

    const sessionData = getSession(id, req.user?.userId);
    if (!sessionData) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      session: sessionData.session,
      messages: sessionData.messages,
      systemPrompt: sessionData.systemPrompt,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/sessions/:id - セッション更新
 */
router.put('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
      return;
    }

    const { title } = req.body;

    if (title !== undefined) {
      const success = updateSessionTitle(id, title, req.user?.userId);
      if (!success) {
        res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
        return;
      }
    }

    const sessionData = getSession(id, req.user?.userId);
    res.json({ session: sessionData?.session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/sessions/:id - セッション削除
 */
router.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
      return;
    }

    const success = deleteSession(id, req.user?.userId);
    if (!success) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session', code: 'INTERNAL_ERROR' });
  }
});

export default router;
