/**
 * モード API ルート
 */

import { Router, Response } from 'express';
import {
  getAllModes,
  getModeById,
  createMode,
  updateMode,
  deleteMode,
} from '../../utils/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/modes - モード一覧取得
 */
router.get('/', (req, res: Response) => {
  try {
    const modes = getAllModes();
    res.json({ modes });
  } catch (error) {
    console.error('Get modes error:', error);
    res.status(500).json({ error: 'Failed to get modes', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/modes/:id - モード取得
 */
router.get('/:id', (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid mode ID', code: 'INVALID_ID' });
      return;
    }

    const mode = getModeById(id);
    if (!mode) {
      res.status(404).json({ error: 'Mode not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ mode });
  } catch (error) {
    console.error('Get mode error:', error);
    res.status(500).json({ error: 'Failed to get mode', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/modes - モード作成
 */
router.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, displayName, description, icon, systemPrompt } = req.body;

    // バリデーション
    if (!name || !displayName) {
      res.status(400).json({ error: 'Name and displayName are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const id = createMode(name, displayName, description || null, icon || null, systemPrompt || null);

    const mode = getModeById(id);
    res.status(201).json({ mode });
  } catch (error) {
    console.error('Create mode error:', error);
    res.status(500).json({ error: 'Failed to create mode', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/modes/:id - モード更新
 */
router.put('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid mode ID', code: 'INVALID_ID' });
      return;
    }

    const { name, displayName, description, icon, systemPrompt } = req.body;

    const success = updateMode(id, {
      name,
      displayName,
      description,
      icon,
      systemPrompt,
    });

    if (!success) {
      res.status(404).json({ error: 'Mode not found', code: 'NOT_FOUND' });
      return;
    }

    const mode = getModeById(id);
    res.json({ mode });
  } catch (error) {
    console.error('Update mode error:', error);
    res.status(500).json({ error: 'Failed to update mode', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/modes/:id - モード削除
 */
router.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid mode ID', code: 'INVALID_ID' });
      return;
    }

    const mode = getModeById(id);
    if (!mode) {
      res.status(404).json({ error: 'Mode not found', code: 'NOT_FOUND' });
      return;
    }

    if (mode.is_default === 1) {
      res.status(403).json({ error: 'Cannot delete default mode', code: 'FORBIDDEN' });
      return;
    }

    const success = deleteMode(id);
    if (!success) {
      res.status(500).json({ error: 'Failed to delete mode', code: 'INTERNAL_ERROR' });
      return;
    }

    res.json({ message: 'Mode deleted successfully' });
  } catch (error) {
    console.error('Delete mode error:', error);
    res.status(500).json({ error: 'Failed to delete mode', code: 'INTERNAL_ERROR' });
  }
});

export default router;
