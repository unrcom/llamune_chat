/**
 * フォルダ管理APIルート
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  updateSessionFolder,
  getTrashFolder,
  hardDeleteSession,
} from '../../utils/database.js';

const router = Router();

// フォルダ一覧取得
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const folders = listFolders(userId);
    res.json({ folders });
  } catch (err) {
    console.error('Failed to list folders:', err);
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

// フォルダ作成
router.post('/', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { name, icon, sort_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = createFolder({
      name: name.trim(),
      icon: icon ?? null,
      sort_order: sort_order ?? 100,
      userId,
    });

    res.status(201).json({ folder: { id, name: name.trim(), icon: icon ?? null, sort_order: sort_order ?? 100 } });
  } catch (err) {
    console.error('Failed to create folder:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// フォルダ更新
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const folderId = Number(req.params.id);
    const { name, icon, sort_order } = req.body;

    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder id' });
    }

    const updated = updateFolder(folderId, { name, icon, sort_order }, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update folder:', err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// フォルダ削除
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const folderId = Number(req.params.id);

    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder id' });
    }

    const deleted = deleteFolder(folderId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete folder:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// セッションのフォルダを変更
router.put('/:id/sessions/:sessionId', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const folderId = Number(req.params.id);
    const sessionId = Number(req.params.sessionId);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    // folderId=0 はフォルダなし（NULL）扱い
    const targetFolderId = folderId === 0 ? null : folderId;
    const updated = updateSessionFolder(sessionId, targetFolderId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update session folder:', err);
    res.status(500).json({ error: 'Failed to update session folder' });
  }
});

export default router;

// ゴミ箱フォルダ取得
router.get('/trash', authMiddleware, (req, res) => {
  try {
    const trash = getTrashFolder();
    res.json({ folder: trash });
  } catch (err) {
    console.error('Failed to get trash folder:', err);
    res.status(500).json({ error: 'Failed to get trash folder' });
  }
});

// ゴミ箱内セッションを物理削除
router.delete('/trash/sessions/:sessionId', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const sessionId = Number(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const deleted = hardDeleteSession(sessionId, userId);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to hard delete session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});
