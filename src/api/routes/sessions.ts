/**
 * セッション API ルート
 */

import { Router, Response } from 'express';
import {
  createSession,
  listSessions,
  getSession,
  updateSessionTitle,
  updateSessionPsetsCurrent,
  updatePsetsCurrent,
  getLatestPsetsCurrent,
  deleteSession,
} from '../../utils/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

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
    const { templateId, projectPath, model } = req.body;

    if (!templateId) {
      res.status(400).json({ error: 'templateId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const sessionId = createSession(templateId, req.user?.userId, projectPath, model);

    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(500).json({ error: 'Failed to create session', code: 'INTERNAL_ERROR' });
      return;
    }

    res.status(201).json({
      session: sessionData.session,
      systemPrompt: sessionData.systemPrompt,
      psetsName: sessionData.psetsName,
      psetsIcon: sessionData.psetsIcon,
      model: sessionData.model,
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
      psetsName: sessionData.psetsName,
      psetsIcon: sessionData.psetsIcon,
      model: sessionData.model,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/sessions/:id - セッション更新（タイトル）
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
 * PUT /api/sessions/:id/psets - psets_currentを更新
 */
router.put('/:id/psets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
      return;
    }

    // psets_currentに新しいレコードをinsert（seq++）
    const newPsetsCurrentId = updatePsetsCurrent(id, req.body);

    // sessionsのpsets_current_idを更新
    updateSessionPsetsCurrent(id, newPsetsCurrentId);

    const psetsCurrent = getLatestPsetsCurrent(id);
    res.json({ psets_current: psetsCurrent });
  } catch (error) {
    console.error('Update session psets error:', error);
    res.status(500).json({ error: 'Failed to update psets', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/sessions/:id/psets - psets_currentを取得
 */
router.get('/:id/psets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
      return;
    }

    const psetsCurrent = getLatestPsetsCurrent(id);
    if (!psetsCurrent) {
      res.status(404).json({ error: 'Psets not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ psets_current: psetsCurrent });
  } catch (error) {
    console.error('Get session psets error:', error);
    res.status(500).json({ error: 'Failed to get psets', code: 'INTERNAL_ERROR' });
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

/**
 * GET /api/sessions/:id/export - セッションをJSON形式でエクスポート
 */
router.get('/:id/export', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      session: {
        id: sessionData.session.id,
        title: sessionData.session.title,
        model: sessionData.model,
        created_at: sessionData.session.created_at,
        updated_at: sessionData.session.updated_at,
        project_path: sessionData.session.project_path,
        systemPrompt: sessionData.systemPrompt,
        psetsName: sessionData.psetsName,
        psetsIcon: sessionData.psetsIcon,
      },
      messages: sessionData.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        model: msg.model,
        thinking: msg.thinking,
        is_adopted: msg.is_adopted,
      })),
    };

    const title = sessionData.session.title || 'chat';
    const safeTitle = title
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s-]/g, '')
      .substring(0, 50)
      .trim() || 'chat';

    const filename = `llamune_chat_${safeTitle}_${id}.json`;
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.json(exportData);
  } catch (error) {
    console.error('Export session error:', error);
    res.status(500).json({ error: 'Failed to export session', code: 'INTERNAL_ERROR' });
  }
});

export default router;
