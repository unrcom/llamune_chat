/**
 * プロジェクトディレクトリ用のファイル操作ツール
 * 
 * LLMがFunction Callingを使用してファイルを読み取ったり、
 * ディレクトリ一覧を取得するためのツール定義
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, sep } from 'path';

/**
 * ツール定義（Ollama Function Calling形式）
 */
export const projectTools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'プロジェクト内のファイルの内容を読み取ります。テキストファイル（.ts, .js, .json, .md, .txtなど）の読み取りに使用します。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'プロジェクトルートからの相対パス（例: src/index.ts, package.json）',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: '指定されたディレクトリ内のファイルとサブディレクトリの一覧を取得します。',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'プロジェクトルートからの相対パス（例: src, src/api）。空文字列または "." でルートディレクトリを指定',
          },
        },
        required: ['directory'],
      },
    },
  },
];

/**
 * セキュリティ: パスがプロジェクトディレクトリ内かチェック
 */
function isPathSafe(projectPath: string, targetPath: string): boolean {
  const resolved = resolve(projectPath, targetPath);
  const normalized = resolve(projectPath);
  
  // パストラバーサル攻撃を防ぐ
  return resolved.startsWith(normalized + sep) || resolved === normalized;
}

/**
 * ファイルの内容を読み取る
 */
export function readFile(projectPath: string, filePath: string): string {
  try {
    // セキュリティチェック
    if (!isPathSafe(projectPath, filePath)) {
      return `Error: Access denied - path outside project directory`;
    }

    const fullPath = resolve(projectPath, filePath);

    // ファイルが存在するかチェック
    if (!existsSync(fullPath)) {
      return `Error: File not found: ${filePath}`;
    }

    // ディレクトリではないかチェック
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return `Error: "${filePath}" is a directory, not a file. Use list_files instead.`;
    }

    // ファイルサイズチェック（1MB制限）
    if (stats.size > 1024 * 1024) {
      return `Error: File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 1MB.`;
    }

    // ファイルを読み取り
    const content = readFileSync(fullPath, 'utf-8');
    return content;
  } catch (error) {
    if (error instanceof Error) {
      return `Error reading file: ${error.message}`;
    }
    return `Error: Unknown error occurred`;
  }
}

/**
 * ディレクトリ内のファイル一覧を取得
 */
export function listFiles(projectPath: string, directory: string): string {
  try {
    // 空文字列や "." はルートディレクトリとして扱う
    const normalizedDir = directory === '' || directory === '.' ? '' : directory;

    // セキュリティチェック
    if (!isPathSafe(projectPath, normalizedDir)) {
      return `Error: Access denied - path outside project directory`;
    }

    const fullPath = normalizedDir 
      ? resolve(projectPath, normalizedDir)
      : projectPath;

    // ディレクトリが存在するかチェック
    if (!existsSync(fullPath)) {
      return `Error: Directory not found: ${directory || '(root)'}`;
    }

    // ディレクトリかチェック
    const stats = statSync(fullPath);
    if (!stats.isDirectory()) {
      return `Error: "${directory}" is a file, not a directory. Use read_file instead.`;
    }

    // ディレクトリ内容を取得
    const entries = readdirSync(fullPath, { withFileTypes: true });

    // 隠しファイル/ディレクトリを除外
    const filtered = entries.filter(entry => !entry.name.startsWith('.'));

    // ファイルとディレクトリを分類
    const directories = filtered
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name + '/');
    
    const files = filtered
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    // 結果をフォーマット
    const result = {
      directory: directory || '(root)',
      directories: directories.sort(),
      files: files.sort(),
      total: directories.length + files.length,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing directory: ${error.message}`;
    }
    return `Error: Unknown error occurred`;
  }
}

/**
 * ファイルツリーを生成（初期プロンプト用）
 */
export function generateFileTree(projectPath: string, maxDepth: number = 3): string {
  try {
    if (!existsSync(projectPath)) {
      return `Error: Project path does not exist: ${projectPath}`;
    }

    const tree: string[] = [];
    
    function traverse(dir: string, depth: number, prefix: string = '') {
      if (depth > maxDepth) return;

      const entries = readdirSync(dir, { withFileTypes: true });
      
      // 除外パターン
      const excludePatterns = [
        /^node_modules$/,
        /^\.git$/,
        /^\.next$/,
        /^dist$/,
        /^build$/,
        /^\./,
      ];

      const filtered = entries.filter(entry => 
        !excludePatterns.some(pattern => pattern.test(entry.name))
      );

      const sorted = filtered.sort((a, b) => {
        // ディレクトリを先に表示
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      sorted.forEach((entry, index) => {
        const isLast = index === sorted.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');

        const displayName = entry.isDirectory() ? entry.name + '/' : entry.name;
        tree.push(`${prefix}${connector}${displayName}`);

        if (entry.isDirectory()) {
          traverse(join(dir, entry.name), depth + 1, nextPrefix);
        }
      });
    }

    const projectName = projectPath.split(sep).pop() || 'project';
    tree.push(projectName + '/');
    traverse(projectPath, 0, '');

    return tree.join('\n');
  } catch (error) {
    if (error instanceof Error) {
      return `Error generating file tree: ${error.message}`;
    }
    return `Error: Unknown error occurred`;
  }
}

/**
 * ツール呼び出しを実行
 */
export function executeToolCall(
  projectPath: string,
  toolName: string,
  args: Record<string, unknown>
): string {
  try {
    switch (toolName) {
      case 'read_file':
        if (!args.path || typeof args.path !== 'string') {
          return 'Error: path parameter is required';
        }
        return readFile(projectPath, args.path);

      case 'list_files':
        if (args.directory === undefined) {
          return 'Error: directory parameter is required';
        }
        return listFiles(projectPath, String(args.directory));

      default:
        return `Error: Unknown tool: ${toolName}`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return `Error executing tool: ${error.message}`;
    }
    return `Error: Unknown error occurred`;
  }
}
