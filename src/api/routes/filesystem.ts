/**
 * ファイルシステムAPIルート
 * ディレクトリツリーの取得
 */

import { Router, Request, Response } from 'express';
import { readdirSync, statSync } from 'fs';
import { join, normalize, resolve } from 'path';
import { homedir } from 'os';

const router = Router();

interface DirectoryNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
}

/**
 * パスがホームディレクトリ以下かチェック
 */
function isWithinHomeDirectory(targetPath: string): boolean {
  const home = homedir();
  const normalizedPath = normalize(resolve(targetPath));
  return normalizedPath.startsWith(home);
}

/**
 * ディレクトリツリーを取得（1階層のみ）
 */
function getDirectoryContents(dirPath: string): DirectoryNode[] {
  try {
    const items = readdirSync(dirPath);
    const nodes: DirectoryNode[] = [];

    for (const item of items) {
      // 隠しファイル・ディレクトリをスキップ
      if (item.startsWith('.')) continue;

      const fullPath = join(dirPath, item);

      try {
        const stat = statSync(fullPath);

        // ディレクトリのみ
        if (stat.isDirectory()) {
          nodes.push({
            name: item,
            path: fullPath,
            isDirectory: true,
          });
        }
      } catch {
        // アクセス権限がない場合などはスキップ
        continue;
      }
    }

    // 名前でソート
    return nodes.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

/**
 * GET /api/filesystem/tree
 * ディレクトリツリーを取得
 */
router.get('/tree', (req: Request, res: Response) => {
  try {
    const path = req.query.path as string | undefined;

    // パスが指定されていない場合、ホームディレクトリを返す
    if (!path) {
      const home = homedir();
      const contents = getDirectoryContents(home);
      res.json({
        path: home,
        name: '~',
        isDirectory: true,
        children: contents,
      });
      return;
    }

    // パスの正規化
    const normalizedPath = normalize(resolve(path));

    // セキュリティチェック：ホームディレクトリ以下か
    if (!isWithinHomeDirectory(normalizedPath)) {
      res.status(403).json({
        error: 'Access denied: Path outside home directory',
      });
      return;
    }

    // ディレクトリの存在確認
    try {
      const stat = statSync(normalizedPath);
      if (!stat.isDirectory()) {
        res.status(400).json({
          error: 'Path is not a directory',
        });
        return;
      }
    } catch {
      res.status(404).json({
        error: 'Directory not found',
      });
      return;
    }

    // ディレクトリの内容を取得
    const contents = getDirectoryContents(normalizedPath);

    res.json({
      path: normalizedPath,
      name: path.split('/').pop() || '~',
      isDirectory: true,
      children: contents,
    });
  } catch (error) {
    console.error('Error in /api/filesystem/tree:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/filesystem/home
 * ホームディレクトリのパスを取得
 */
router.get('/home', (_req: Request, res: Response) => {
  try {
    const home = homedir();
    res.json({
      path: home,
    });
  } catch (error) {
    console.error('Error in /api/filesystem/home:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
