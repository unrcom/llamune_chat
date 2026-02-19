/**
 * データベース管理ユーティリティ
 * SQLiteを使用して会話履歴を保存
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { encrypt, decrypt } from './encryption.js';

// データベースファイルのパス
const DB_DIR = join(homedir(), '.llamune_chat');
const DB_FILE = join(DB_DIR, 'data.db');

// ========================================
// 型定義
// ========================================

/**
 * ユーザーの型定義
 */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

/**
 * リフレッシュトークンの型定義
 */
export interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  device_fingerprint?: string;
  device_type?: string;
  source?: string;
  created_at: string;
}

/**
 * パラメータセットテンプレートの型定義
 */
export interface PsetsTemplate {
  id: number;
  version: number;
  visibility: 'public' | 'private';
  sort_order: number;
  psets_name: string;
  icon: string | null;
  description: string | null;
  model: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  context_messages: number | null;
  temperature: number | null;
  top_p: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

/**
 * パラメータセットテンプレート履歴の型定義
 */
export interface PsetsTemplateHistory {
  id: number;
  template_id: number;
  version: number;
  visibility: 'public' | 'private';
  sort_order: number;
  psets_name: string;
  icon: string | null;
  description: string | null;
  model: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  context_messages: number | null;
  temperature: number | null;
  top_p: number | null;
  created_at: string;
}

/**
 * セッション別パラメータセットの型定義
 */
export interface PsetsCurrent {
  id: number;
  session_id: number;
  template_id: number | null;
  template_version: number | null;
  seq: number;
  psets_name: string;
  icon: string | null;
  description: string | null;
  model: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  context_messages: number | null;
  temperature: number | null;
  top_p: number | null;
  created_at: string;
}

/**
 * セッションの型定義
 */
export interface Session {
  id: number;
  user_id: number | null;
  title: string | null;
  project_path: string | null;
  psets_current_id: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * セッション一覧用の型定義
 */
export interface SessionListItem {
  id: number;
  title: string | null;
  message_count: number;
  preview: string | null;
  created_at: string;
  updated_at: string;
  psets_name?: string;
  psets_icon?: string;
  model?: string;
  project_path?: string;
}

/**
 * メッセージの型定義
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  model?: string;
  thinking?: string;
  is_adopted?: boolean;
}

/**
 * メッセージターンの型定義
 */
interface MessageWithId {
  id: number;
  role: string;
  content: string;
  model?: string;
  is_adopted?: number;
}

export interface MessageTurn {
  turnNumber: number;
  user: MessageWithId;
  assistant: MessageWithId;
}

// ========================================
// デフォルトテンプレートのシステムプロンプト
// ========================================

const DEFAULT_PROFESSIONAL_PROMPT = `**必ず日本語で応答してください。**

あなたはアプリケーション開発の専門家です。以下のガイドラインに従ってコードを生成してください：

1. **コード品質**
   - 読みやすく、保守しやすいコードを書く
   - 適切な命名規則を使用する
   - 必要に応じてコメントを追加する
   - DRY原則（Don't Repeat Yourself）を守る

2. **ベストプラクティス**
   - 型安全性を重視する（TypeScriptの場合）
   - エラーハンドリングを適切に行う
   - セキュリティを考慮する（SQLインジェクション、XSSなど）
   - パフォーマンスを考慮する

3. **既存コードとの整合性**
   - プロジェクトの既存のコーディングスタイルに合わせる
   - 既存のアーキテクチャパターンを踏襲する
   - 依存関係を適切に管理する

4. **テスト**
   - 可能な限りテストしやすいコードを書く
   - エッジケースを考慮する`;

// ========================================
// データベース初期化
// ========================================

/**
 * データベースを初期化
 */
export function initDatabase(): Database.Database {
  // ディレクトリがなければ作成
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE);

  // 外部キー制約を有効化
  db.pragma('foreign_keys = ON');

  // ========================================
  // テーブル作成
  // ========================================

  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // リフレッシュトークンテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      device_fingerprint TEXT,
      device_type TEXT,
      source TEXT,
      last_used_at TEXT,
      created_via TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // パラメータセットテンプレートテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS psets_template (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL DEFAULT 1,
      visibility TEXT NOT NULL DEFAULT 'private',
      sort_order INTEGER NOT NULL DEFAULT 100,
      psets_name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      model TEXT,
      system_prompt TEXT,
      max_tokens INTEGER,
      context_messages INTEGER,
      temperature REAL,
      top_p REAL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // パラメータセットテンプレート履歴テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS psets_template_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      visibility TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      psets_name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      model TEXT,
      system_prompt TEXT,
      max_tokens INTEGER,
      context_messages INTEGER,
      temperature REAL,
      top_p REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES psets_template(id)
    )
  `);

  // セッション別パラメータセットテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS psets_current (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      template_id INTEGER,
      template_version INTEGER,
      seq INTEGER NOT NULL DEFAULT 0,
      psets_name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      model TEXT,
      system_prompt TEXT,
      max_tokens INTEGER,
      context_messages INTEGER,
      temperature REAL,
      top_p REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // セッションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT,
      project_path TEXT,
      psets_current_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (psets_current_id) REFERENCES psets_current(id)
    )
  `);

  // メッセージテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      thinking TEXT,
      is_adopted INTEGER DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // デフォルトテンプレートの初期化
  initializeDefaultTemplates(db);

  return db;
}

/**
 * デフォルトテンプレートを初期化
 */
function initializeDefaultTemplates(db: Database.Database): void {
  const now = new Date().toISOString();

  // あなたの本職を支援
  const professionalExists = db
    .prepare("SELECT id FROM psets_template WHERE psets_name = 'あなたの本職を支援'")
    .get();

  if (!professionalExists) {
    db.prepare(`
      INSERT INTO psets_template (version, visibility, sort_order, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'public', 10, 'あなたの本職を支援', '💻', 'コード生成の支援', null, DEFAULT_PROFESSIONAL_PROMPT, null, null, null, null, 1, now, now);
  }

  // 一般的な対話
  const generalExists = db
    .prepare("SELECT id FROM psets_template WHERE psets_name = '一般的な対話'")
    .get();

  if (!generalExists) {
    db.prepare(`
      INSERT INTO psets_template (version, visibility, sort_order, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'public', 20, '一般的な対話', '🤖', '一般的な対話と推論', null, null, null, null, null, null, 1, now, now);
  }
}

// ========================================
// パラメータセットテンプレート管理
// ========================================

/**
 * すべてのテンプレートを取得（enabled=1のみ）
 */
export function getAllPsetsTemplates(): PsetsTemplate[] {
  const db = initDatabase();

  try {
    return db
      .prepare('SELECT * FROM psets_template WHERE enabled = 1 ORDER BY sort_order ASC, id ASC')
      .all() as PsetsTemplate[];
  } finally {
    db.close();
  }
}

/**
 * IDでテンプレートを取得
 */
export function getPsetsTemplateById(id: number): PsetsTemplate | null {
  const db = initDatabase();

  try {
    const template = db
      .prepare('SELECT * FROM psets_template WHERE id = ?')
      .get(id) as PsetsTemplate | undefined;

    return template || null;
  } finally {
    db.close();
  }
}

/**
 * テンプレートを作成
 */
export function createPsetsTemplate(params: {
  visibility: 'public' | 'private';
  sort_order?: number;
  psets_name: string;
  icon?: string | null;
  description?: string | null;
  model?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  context_messages?: number | null;
  temperature?: number | null;
  top_p?: number | null;
}): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO psets_template (version, visibility, sort_order, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, enabled, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      params.visibility,
      params.sort_order ?? 100,
      params.psets_name,
      params.icon ?? null,
      params.description ?? null,
      params.model ?? null,
      params.system_prompt ?? null,
      params.max_tokens ?? null,
      params.context_messages ?? null,
      params.temperature ?? null,
      params.top_p ?? null,
      now,
      now
    );

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * テンプレートを更新（履歴保存 + version++）
 */
export function updatePsetsTemplate(
  id: number,
  updates: Partial<Omit<PsetsTemplate, 'id' | 'version' | 'created_at' | 'updated_at'>>
): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const template = db.prepare('SELECT * FROM psets_template WHERE id = ?').get(id) as PsetsTemplate | undefined;
    if (!template) return false;

    // 更新前の内容を履歴に保存
    db.prepare(`
      INSERT INTO psets_template_history (template_id, version, visibility, sort_order, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      template.id,
      template.version,
      template.visibility,
      template.sort_order,
      template.psets_name,
      template.icon,
      template.description,
      template.model,
      template.system_prompt,
      template.max_tokens,
      template.context_messages,
      template.temperature,
      template.top_p,
      now
    );

    // テンプレートを更新（version++）
    const result = db.prepare(`
      UPDATE psets_template SET
        version = version + 1,
        visibility = ?,
        sort_order = ?,
        psets_name = ?,
        icon = ?,
        description = ?,
        model = ?,
        system_prompt = ?,
        max_tokens = ?,
        context_messages = ?,
        temperature = ?,
        top_p = ?,
        enabled = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.visibility ?? template.visibility,
      updates.sort_order ?? template.sort_order,
      updates.psets_name ?? template.psets_name,
      updates.icon !== undefined ? updates.icon : template.icon,
      updates.description !== undefined ? updates.description : template.description,
      updates.model !== undefined ? updates.model : template.model,
      updates.system_prompt !== undefined ? updates.system_prompt : template.system_prompt,
      updates.max_tokens !== undefined ? updates.max_tokens : template.max_tokens,
      updates.context_messages !== undefined ? updates.context_messages : template.context_messages,
      updates.temperature !== undefined ? updates.temperature : template.temperature,
      updates.top_p !== undefined ? updates.top_p : template.top_p,
      updates.enabled !== undefined ? updates.enabled : template.enabled,
      now,
      id
    );

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * テンプレートを論理削除（enabled=0）
 */
export function disablePsetsTemplate(id: number): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE psets_template SET enabled = 0, updated_at = ? WHERE id = ?')
      .run(now, id);

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * テンプレートをコピー（version=1、名前に「のコピー」を追加）
 */
export function copyPsetsTemplate(id: number): number | null {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const template = db.prepare('SELECT * FROM psets_template WHERE id = ?').get(id) as PsetsTemplate | undefined;
    if (!template) return null;

    const result = db.prepare(`
      INSERT INTO psets_template (version, visibility, sort_order, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, enabled, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      template.visibility,
      template.sort_order + 1,
      `${template.psets_name} のコピー`,
      template.icon,
      template.description,
      template.model,
      template.system_prompt,
      template.max_tokens,
      template.context_messages,
      template.temperature,
      template.top_p,
      now,
      now
    );

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * テンプレートの表示順を更新（ドラッグ＆ドロップ用）
 */
export function updatePsetsTemplateSortOrder(orders: { id: number; sort_order: number }[]): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const update = db.prepare('UPDATE psets_template SET sort_order = ?, updated_at = ? WHERE id = ?');
    const updateMany = db.transaction((items: { id: number; sort_order: number }[]) => {
      for (const item of items) {
        update.run(item.sort_order, now, item.id);
      }
    });
    updateMany(orders);
  } finally {
    db.close();
  }
}

// ========================================
// psets_current 管理
// ========================================

/**
 * セッション作成時にテンプレートからpsets_currentを作成
 */
export function createPsetsCurrent(
  sessionId: number,
  template: PsetsTemplate
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO psets_current (session_id, template_id, template_version, seq, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, created_at)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      template.id,
      template.version,
      template.psets_name,
      template.icon,
      template.description,
      template.model,
      template.system_prompt,
      template.max_tokens,
      template.context_messages,
      template.temperature,
      template.top_p,
      now
    );

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * psets_currentを更新（seq++して新しいレコードをinsert）
 */
export function updatePsetsCurrent(
  sessionId: number,
  updates: Partial<Omit<PsetsCurrent, 'id' | 'session_id' | 'seq' | 'created_at'>>
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    // 現在の最新レコードを取得
    const current = db
      .prepare('SELECT * FROM psets_current WHERE session_id = ? ORDER BY seq DESC LIMIT 1')
      .get(sessionId) as PsetsCurrent | undefined;

    const nextSeq = current ? current.seq + 1 : 0;

    const result = db.prepare(`
      INSERT INTO psets_current (session_id, template_id, template_version, seq, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      updates.template_id !== undefined ? updates.template_id : (current?.template_id ?? null),
      updates.template_version !== undefined ? updates.template_version : (current?.template_version ?? null),
      nextSeq,
      updates.psets_name ?? current?.psets_name ?? '',
      updates.icon !== undefined ? updates.icon : (current?.icon ?? null),
      updates.description !== undefined ? updates.description : (current?.description ?? null),
      updates.model !== undefined ? updates.model : (current?.model ?? null),
      updates.system_prompt !== undefined ? updates.system_prompt : (current?.system_prompt ?? null),
      updates.max_tokens !== undefined ? updates.max_tokens : (current?.max_tokens ?? null),
      updates.context_messages !== undefined ? updates.context_messages : (current?.context_messages ?? null),
      updates.temperature !== undefined ? updates.temperature : (current?.temperature ?? null),
      updates.top_p !== undefined ? updates.top_p : (current?.top_p ?? null),
      now
    );

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * セッションの最新psets_currentを取得
 */
export function getLatestPsetsCurrent(sessionId: number): PsetsCurrent | null {
  const db = initDatabase();

  try {
    const current = db
      .prepare('SELECT * FROM psets_current WHERE session_id = ? ORDER BY seq DESC LIMIT 1')
      .get(sessionId) as PsetsCurrent | undefined;

    return current || null;
  } finally {
    db.close();
  }
}

// ========================================
// セッション管理
// ========================================

/**
 * 新しいセッションを作成
 */
export function createSession(
  templateId: number,
  userId?: number,
  projectPath?: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    // テンプレートを取得
    const template = db.prepare('SELECT * FROM psets_template WHERE id = ?').get(templateId) as PsetsTemplate | undefined;
    if (!template) throw new Error(`PsetsTemplate not found: ${templateId}`);

    // セッションを作成（psets_current_idは後で更新）
    const sessionResult = db.prepare(`
      INSERT INTO sessions (user_id, title, project_path, psets_current_id, created_at, updated_at)
      VALUES (?, NULL, ?, NULL, ?, ?)
    `).run(userId || null, projectPath || null, now, now);

    const sessionId = sessionResult.lastInsertRowid as number;

    // psets_currentを作成
    const psetsCurrentResult = db.prepare(`
      INSERT INTO psets_current (session_id, template_id, template_version, seq, psets_name, icon, description, model, system_prompt, max_tokens, context_messages, temperature, top_p, created_at)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      template.id,
      template.version,
      template.psets_name,
      template.icon,
      template.description,
      template.model,
      template.system_prompt,
      template.max_tokens,
      template.context_messages,
      template.temperature,
      template.top_p,
      now
    );

    const psetsCurrentId = psetsCurrentResult.lastInsertRowid as number;

    // sessionsのpsets_current_idを更新
    db.prepare('UPDATE sessions SET psets_current_id = ? WHERE id = ?').run(psetsCurrentId, sessionId);

    return sessionId;
  } finally {
    db.close();
  }
}

/**
 * セッション一覧を取得（新しい順）
 */
export function listSessions(limit = 200, userId?: number): SessionListItem[] {
  const db = initDatabase();

  try {
    let query = `
      SELECT
        s.id,
        s.title,
        s.project_path,
        s.created_at,
        s.updated_at,
        pc.psets_name,
        pc.icon as psets_icon,
        pc.model,
        COUNT(m.id) as message_count,
        (
          SELECT content
          FROM messages
          WHERE session_id = s.id AND role = 'user' AND deleted_at IS NULL
          ORDER BY id ASC
          LIMIT 1
        ) as preview
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id AND m.deleted_at IS NULL
      LEFT JOIN psets_current pc ON s.psets_current_id = pc.id
    `;

    if (userId !== undefined) {
      query += ` WHERE s.user_id = ? `;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ?
    `;

    const sessions = userId !== undefined
      ? db.prepare(query).all(userId, limit) as SessionListItem[]
      : db.prepare(query).all(limit) as SessionListItem[];

    // previewを復号
    return sessions.map(session => {
      if (session.preview) {
        try {
          session.preview = decrypt(session.preview);
        } catch {
          // 復号に失敗した場合は元のまま
        }
      }
      return session;
    });
  } finally {
    db.close();
  }
}

/**
 * セッションを取得
 */
export function getSession(sessionId: number, userId?: number): {
  session: Session;
  messages: Message[];
  systemPrompt?: string;
  psetsName?: string;
  psetsIcon?: string;
  model?: string;
} | null {
  const db = initDatabase();

  try {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Session | undefined;

    if (!session) return null;

    // 所有者チェック
    if (userId !== undefined && session.user_id !== userId) return null;

    // psets_currentから情報を取得
    let systemPrompt: string | undefined;
    let psetsName: string | undefined;
    let psetsIcon: string | undefined;
    let model: string | undefined;

    if (session.psets_current_id) {
      const pc = db
        .prepare('SELECT * FROM psets_current WHERE id = ?')
        .get(session.psets_current_id) as PsetsCurrent | undefined;

      if (pc) {
        systemPrompt = pc.system_prompt || undefined;
        psetsName = pc.psets_name;
        psetsIcon = pc.icon || undefined;
        model = pc.model || undefined;
      }
    }

    // メッセージを取得
    const messagesRaw = db
      .prepare(`
        SELECT role, content, model, thinking, is_adopted
        FROM messages
        WHERE session_id = ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      .all(sessionId) as Array<{
        role: string;
        content: string;
        model?: string;
        thinking?: string;
        is_adopted?: number;
      }>;

    // メッセージを復号
    const messages: Message[] = messagesRaw.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
      content: decrypt(msg.content),
      model: msg.model,
      thinking: msg.thinking ? decrypt(msg.thinking) : undefined,
      is_adopted: msg.is_adopted !== 0,
    }));

    return { session, messages, systemPrompt, psetsName, psetsIcon, model };
  } finally {
    db.close();
  }
}

/**
 * セッションのタイトルを更新
 */
export function updateSessionTitle(sessionId: number, title: string, userId?: number): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    let query = 'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?';
    const params: (string | number)[] = [title, now, sessionId];

    if (userId !== undefined) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * セッションのpsets_current_idを更新
 */
export function updateSessionPsetsCurrent(sessionId: number, psetsCurrentId: number): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE sessions SET psets_current_id = ?, updated_at = ? WHERE id = ?')
      .run(psetsCurrentId, now, sessionId);

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * セッションを削除
 */
export function deleteSession(sessionId: number, userId?: number): boolean {
  const db = initDatabase();

  try {
    let query = 'DELETE FROM sessions WHERE id = ?';
    const params: number[] = [sessionId];

    if (userId !== undefined) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

// ========================================
// メッセージ管理
// ========================================

/**
 * メッセージを保存
 */
export function saveMessage(
  sessionId: number,
  role: string,
  content: string,
  model?: string,
  thinking?: string
): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const encryptedContent = encrypt(content);
    const encryptedThinking = thinking ? encrypt(thinking) : null;

    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at, model, thinking) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, role, encryptedContent, now, model || null, encryptedThinking);

    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    // 最初のユーザーメッセージの場合、タイトルを自動設定
    if (role === 'user') {
      const session = db
        .prepare('SELECT title FROM sessions WHERE id = ?')
        .get(sessionId) as { title: string | null } | undefined;

      if (session && !session.title) {
        const title = content.length > 30 ? content.substring(0, 30) + '...' : content;
        db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, sessionId);
      }
    }
  } finally {
    db.close();
  }
}

/**
 * ターン付きメッセージを取得
 */
export function getSessionMessagesWithTurns(sessionId: number): MessageTurn[] {
  const db = initDatabase();

  try {
    const messages = db
      .prepare(`
        SELECT id, role, content, model
        FROM messages
        WHERE session_id = ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      .all(sessionId) as MessageWithId[];

    const turns: MessageTurn[] = [];
    for (let i = 0; i < messages.length; i += 2) {
      if (i + 1 < messages.length && messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
        turns.push({
          turnNumber: Math.floor(i / 2) + 1,
          user: messages[i],
          assistant: messages[i + 1],
        });
      }
    }

    return turns;
  } finally {
    db.close();
  }
}

/**
 * 指定した往復番号以降のメッセージを論理削除
 */
export function logicalDeleteMessagesAfterTurn(sessionId: number, turnNumber: number): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const messages = db
      .prepare(`
        SELECT id
        FROM messages
        WHERE session_id = ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      .all(sessionId) as Array<{ id: number }>;

    const deleteFromIndex = turnNumber * 2;
    const messageIdsToDelete = messages.slice(deleteFromIndex).map((m) => m.id);

    if (messageIdsToDelete.length === 0) return 0;

    const placeholders = messageIdsToDelete.map(() => '?').join(',');
    const result = db
      .prepare(`UPDATE messages SET deleted_at = ? WHERE id IN (${placeholders})`)
      .run(now, ...messageIdsToDelete);

    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    return result.changes;
  } finally {
    db.close();
  }
}

/**
 * 最後から2番目のアシスタントメッセージを削除
 */
export function deleteSecondLastAssistantMessage(sessionId: number): boolean {
  const db = initDatabase();

  try {
    const assistantMessages = db
      .prepare('SELECT id FROM messages WHERE session_id = ? AND role = ? ORDER BY id DESC LIMIT 2')
      .all(sessionId, 'assistant') as { id: number }[];

    if (assistantMessages.length < 2) return false;

    db.prepare('DELETE FROM messages WHERE id = ?').run(assistantMessages[1].id);
    return true;
  } finally {
    db.close();
  }
}

/**
 * 最後のアシスタントメッセージを削除
 */
export function deleteLastAssistantMessage(sessionId: number): boolean {
  const db = initDatabase();

  try {
    const lastMessage = db
      .prepare('SELECT id FROM messages WHERE session_id = ? AND role = ? ORDER BY id DESC LIMIT 1')
      .get(sessionId, 'assistant') as { id: number } | undefined;

    if (!lastMessage) return false;

    db.prepare('DELETE FROM messages WHERE id = ?').run(lastMessage.id);
    return true;
  } finally {
    db.close();
  }
}

/**
 * セッションの最新のアシスタントメッセージ群を取得（リトライ候補用）
 */
export function getRetryAssistantMessages(sessionId: number): Array<{ id: number; model?: string }> {
  const db = initDatabase();

  try {
    const lastUserMessage = db
      .prepare('SELECT id FROM messages WHERE session_id = ? AND role = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1')
      .get(sessionId, 'user') as { id: number } | undefined;

    if (!lastUserMessage) return [];

    return db
      .prepare(`
        SELECT id, model
        FROM messages
        WHERE session_id = ? AND role = ? AND id > ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      .all(sessionId, 'assistant', lastUserMessage.id) as Array<{ id: number; model?: string }>;
  } finally {
    db.close();
  }
}

/**
 * リトライ回答を選択処理
 */
export function selectRetryAnswer(
  sessionId: number,
  adoptedMessageId: number,
  keepMessageIds: number[],
  discardMessageIds: number[]
): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    db.exec('BEGIN TRANSACTION');

    db.prepare('UPDATE messages SET is_adopted = 1 WHERE id = ? AND session_id = ?')
      .run(adoptedMessageId, sessionId);

    for (const messageId of keepMessageIds) {
      db.prepare('UPDATE messages SET is_adopted = 0 WHERE id = ? AND session_id = ?')
        .run(messageId, sessionId);
    }

    for (const messageId of discardMessageIds) {
      db.prepare('DELETE FROM messages WHERE id = ? AND session_id = ?')
        .run(messageId, sessionId);
    }

    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

// ========================================
// ユーザー管理
// ========================================

export function createUser(username: string, passwordHash: string, role: 'admin' | 'user' = 'user'): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, passwordHash, role, now, now);

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

export function getUserByUsername(username: string): User | null {
  const db = initDatabase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

export function getUserById(userId: number): User | null {
  const db = initDatabase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
    return user || null;
  } finally {
    db.close();
  }
}

export function getAllUsers(): User[] {
  const db = initDatabase();

  try {
    return db
      .prepare('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC')
      .all() as User[];
  } finally {
    db.close();
  }
}

export function updateUserPassword(userId: number, newPasswordHash: string): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newPasswordHash, now, userId);

    return result.changes > 0;
  } finally {
    db.close();
  }
}

export function deleteUser(userId: number): boolean {
  const db = initDatabase();

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

// ========================================
// リフレッシュトークン管理
// ========================================

export function saveRefreshToken(
  userId: number,
  token: string,
  expiresAt: string,
  deviceFingerprint?: string,
  deviceType?: string,
  createdVia: 'login' | 'refresh' = 'login'
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(`
        INSERT INTO refresh_tokens
        (user_id, token, expires_at, created_at, device_fingerprint, device_type, last_used_at, created_via)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(userId, token, expiresAt, now, deviceFingerprint, deviceType, now, createdVia);

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

export function getRefreshToken(token: string): RefreshToken | null {
  const db = initDatabase();

  try {
    const refreshToken = db
      .prepare('SELECT * FROM refresh_tokens WHERE token = ?')
      .get(token) as RefreshToken | undefined;

    return refreshToken || null;
  } finally {
    db.close();
  }
}

export function deleteRefreshToken(token: string): boolean {
  const db = initDatabase();

  try {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

export function deleteAllRefreshTokensForUser(userId: number): number {
  const db = initDatabase();

  try {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
    return result.changes;
  } finally {
    db.close();
  }
}

export function cleanupExpiredRefreshTokens(): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
    return result.changes;
  } finally {
    db.close();
  }
}
