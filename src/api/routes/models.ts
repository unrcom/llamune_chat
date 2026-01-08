/**
 * モデル API ルート
 */

import { Router, Response } from 'express';
import { listModels } from '../../utils/ollama.js';

const router = Router();

/**
 * GET /api/models - モデル一覧取得
 */
router.get('/', async (req, res: Response) => {
  try {
    const models = await listModels();
    
    // モデル情報を整形
    const formattedModels = models.map(model => ({
      name: model.name,
      size: model.size,
      sizeFormatted: formatSize(model.size),
      modifiedAt: model.modified_at,
    }));

    res.json({ models: formattedModels });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models', code: 'INTERNAL_ERROR' });
  }
});

/**
 * ファイルサイズを人間が読みやすい形式にフォーマット
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default router;
