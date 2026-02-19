/**
 * パラメータセットテンプレート API ルート
 */

import { Router, Response } from 'express';
import {
  getAllPsetsTemplates,
  getPsetsTemplateById,
  createPsetsTemplate,
  updatePsetsTemplate,
  disablePsetsTemplate,
  copyPsetsTemplate,
  updatePsetsTemplateSortOrder,
} from '../../utils/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/psets_template - テンプレート一覧取得
 */
router.get('/', (req, res: Response) => {
  try {
    const templates = getAllPsetsTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('Get psets_templates error:', error);
    res.status(500).json({ error: 'Failed to get templates', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/psets_template/:id - テンプレート取得
 */
router.get('/:id', (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid template ID', code: 'INVALID_ID' });
      return;
    }

    const template = getPsetsTemplateById(id);
    if (!template) {
      res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ template });
  } catch (error) {
    console.error('Get psets_template error:', error);
    res.status(500).json({ error: 'Failed to get template', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/psets_template - テンプレート作成
 */
router.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      visibility,
      sort_order,
      psets_name,
      icon,
      description,
      model,
      system_prompt,
      max_tokens,
      context_messages,
      temperature,
      top_p,
    } = req.body;

    if (!psets_name) {
      res.status(400).json({ error: 'psets_name is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const id = createPsetsTemplate({
      visibility: visibility || 'private',
      sort_order,
      psets_name,
      icon,
      description,
      model,
      system_prompt,
      max_tokens,
      context_messages,
      temperature,
      top_p,
    });

    const template = getPsetsTemplateById(id);
    res.status(201).json({ template });
  } catch (error) {
    console.error('Create psets_template error:', error);
    res.status(500).json({ error: 'Failed to create template', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/psets_template/:id - テンプレート更新
 */
router.put('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid template ID', code: 'INVALID_ID' });
      return;
    }

    const success = updatePsetsTemplate(id, req.body);
    if (!success) {
      res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
      return;
    }

    const template = getPsetsTemplateById(id);
    res.json({ template });
  } catch (error) {
    console.error('Update psets_template error:', error);
    res.status(500).json({ error: 'Failed to update template', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/psets_template/:id - テンプレート無効化（論理削除）
 */
router.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid template ID', code: 'INVALID_ID' });
      return;
    }

    const success = disablePsetsTemplate(id);
    if (!success) {
      res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ message: 'Template disabled successfully' });
  } catch (error) {
    console.error('Disable psets_template error:', error);
    res.status(500).json({ error: 'Failed to disable template', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/psets_template/:id/copy - テンプレートをコピー
 */
router.post('/:id/copy', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid template ID', code: 'INVALID_ID' });
      return;
    }

    const newId = copyPsetsTemplate(id);
    if (!newId) {
      res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
      return;
    }

    const template = getPsetsTemplateById(newId);
    res.status(201).json({ template });
  } catch (error) {
    console.error('Copy psets_template error:', error);
    res.status(500).json({ error: 'Failed to copy template', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/psets_template/sort_order - 表示順を一括更新
 */
router.put('/sort_order/bulk', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      res.status(400).json({ error: 'orders must be an array', code: 'VALIDATION_ERROR' });
      return;
    }

    updatePsetsTemplateSortOrder(orders);
    res.json({ message: 'Sort order updated successfully' });
  } catch (error) {
    console.error('Update sort order error:', error);
    res.status(500).json({ error: 'Failed to update sort order', code: 'INTERNAL_ERROR' });
  }
});

export default router;
