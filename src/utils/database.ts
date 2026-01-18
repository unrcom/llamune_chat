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
const DB_DIR = join(homedir(), '.llamune');
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
 * モードの型定義
 */
export interface Mode {
  id: number;
  display_name: string;
  description: string | null;
  icon: string | null;
  system_prompt: string | null;
  is_default: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

/**
 * セッションの型定義
 */
export interface Session {
  id: number;
  user_id: number | null;
  model: string;
  mode_id: number | null;
  system_prompt_snapshot: string | null;
  title: string | null;
  project_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * セッション一覧用の型定義
 */
export interface SessionListItem {
  id: number;
  model: string;
  title: string | null;
  message_count: number;
  preview: string | null;
  created_at: string;
  updated_at: string;
  mode_display_name?: string;
  mode_icon?: string;
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
}

/**
 * メッセージターンの型定義
 */
interface MessageWithId {
  id: number;
  role: string;
  content: string;
  model?: string;
}

export interface MessageTurn {
  turnNumber: number;
  user: MessageWithId;
  assistant: MessageWithId;
}

// ========================================
// デフォルトモードのシステムプロンプト
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

  // モードテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS modes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      system_prompt TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // セッションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      model TEXT NOT NULL,
      mode_id INTEGER,
      system_prompt_snapshot TEXT,
      title TEXT,
      project_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (mode_id) REFERENCES modes(id) ON DELETE SET NULL
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
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // デフォルトモードの初期化
  initializeDefaultModes(db);

  return db;
}

/**
 * デフォルトモードを初期化
 */
function initializeDefaultModes(db: Database.Database): void {
  const now = new Date().toISOString();

  // あなたの本職を支援
  const professionalExists = db
    .prepare("SELECT id FROM modes WHERE name = 'professional'")
    .get();

  if (!professionalExists) {
    db.prepare(`
      INSERT INTO modes (name, display_name, description, icon, system_prompt, is_default, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'professional',
      'あなたの本職を支援',
      'コード生成の支援',
      '💻',
      DEFAULT_PROFESSIONAL_PROMPT,
      1,
      1,
      now,
      now
    );
  }

  // 一般的な対話
  const generalExists = db
    .prepare("SELECT id FROM modes WHERE name = 'general'")
    .get();

  if (!generalExists) {
    db.prepare(`
      INSERT INTO modes (name, display_name, description, icon, system_prompt, is_default, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'general',
      '一般的な対話',
      '一般的な対話と推論',
      '🤖',
      null,
      1,
      1,
      now,
      now
    );
  }
}

// ========================================
// モード管理
// ========================================

/**
 * すべてのモードを取得
 */
export function getAllModes(): Mode[] {
  const db = initDatabase();

  try {
    const modes = db
      .prepare('SELECT * FROM modes WHERE enabled = 1 ORDER BY is_default DESC, id ASC')
      .all() as Mode[];

    return modes;
  } finally {
    db.close();
  }
}

/**
 * IDでモードを取得
 */
export function getModeById(id: number): Mode | null {
  const db = initDatabase();

  try {
    const mode = db
      .prepare('SELECT * FROM modes WHERE id = ? AND enabled = 1')
      .get(id) as Mode | undefined;

    return mode || null;
  } finally {
    db.close();
  }
}

/**
 * 名前でモードを取得
 */
/**
 * モードを作成
 */
export function createMode(
  displayName: string,
  description: string | null,
  icon: string | null,
  systemPrompt: string | null
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    // 一意のname生成（内部的にのみ使用、display_nameをベースに作成）
    const baseName = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    let name = baseName;
    let counter = 1;
    
    // 重複チェック
    while (true) {
      const existing = db
        .prepare('SELECT id FROM modes WHERE name = ?')
        .get(name);
      if (!existing) break;
      name = `${baseName}_${counter}`;
      counter++;
    }
    
    const result = db
      .prepare(`
        INSERT INTO modes (name, display_name, description, icon, system_prompt, is_default, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
      `)
      .run(name, displayName, description, icon, systemPrompt, now, now);

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * モードを更新
 */
export function updateMode(
  id: number,
  updates: {
    displayName?: string;
    description?: string | null;
    icon?: string | null;
    systemPrompt?: string | null;
  }
): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const mode = db.prepare('SELECT * FROM modes WHERE id = ?').get(id) as Mode | undefined;
    if (!mode) {
      return false;
    }

    const newDisplayName = updates.displayName ?? mode.display_name;
    const newDescription = updates.description !== undefined ? updates.description : mode.description;
    const newIcon = updates.icon !== undefined ? updates.icon : mode.icon;
    const newSystemPrompt = updates.systemPrompt !== undefined ? updates.systemPrompt : mode.system_prompt;

    const result = db
      .prepare(`
        UPDATE modes 
        SET display_name = ?, description = ?, icon = ?, system_prompt = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(newDisplayName, newDescription, newIcon, newSystemPrompt, now, id);

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * モードを削除（is_default=0のみ）
 */
export function deleteMode(id: number): boolean {
  const db = initDatabase();

  try {
    // デフォルトモードは削除不可
    const mode = db.prepare('SELECT is_default FROM modes WHERE id = ?').get(id) as { is_default: number } | undefined;
    if (!mode || mode.is_default === 1) {
      return false;
    }

    const result = db.prepare('DELETE FROM modes WHERE id = ? AND is_default = 0').run(id);
    return result.changes > 0;
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
  model: string,
  userId?: number,
  modeId?: number,
  projectPath?: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    // モードからシステムプロンプトを取得してスナップショットを保存
    let systemPromptSnapshot: string | null = null;
    if (modeId) {
      const mode = db.prepare('SELECT system_prompt FROM modes WHERE id = ?').get(modeId) as { system_prompt: string | null } | undefined;
      systemPromptSnapshot = mode?.system_prompt || null;
    }

    const result = db
      .prepare(`
        INSERT INTO sessions (model, user_id, mode_id, system_prompt_snapshot, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(model, userId || null, modeId || null, systemPromptSnapshot, projectPath || null, now, now);

    return result.lastInsertRowid as number;
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
        s.model,
        s.created_at,
        s.updated_at,
        s.title,
        s.project_path,
        md.display_name as mode_display_name,
        md.icon as mode_icon,
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
      LEFT JOIN modes md ON s.mode_id = md.id
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
  modeName?: string;
  modeDisplayName?: string;
  modeIcon?: string;
} | null {
  const db = initDatabase();

  try {
    const session = db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(sessionId) as Session | undefined;

    if (!session) {
      return null;
    }

    // 所有者チェック
    if (userId !== undefined && session.user_id !== userId) {
      return null;
    }

    // モード情報とシステムプロンプトを取得
    let systemPrompt: string | undefined;
    let modeDisplayName: string | undefined;
    let modeIcon: string | undefined;

    if (session.system_prompt_snapshot) {
      systemPrompt = session.system_prompt_snapshot;
    }
    
    if (session.mode_id) {
      const mode = db
        .prepare('SELECT display_name, icon, system_prompt FROM modes WHERE id = ?')
        .get(session.mode_id) as { 
          display_name?: string;
          icon?: string;
          system_prompt?: string;
        } | undefined;
      
      if (mode) {
        modeDisplayName = mode.display_name;
        modeIcon = mode.icon || undefined;
        if (!systemPrompt) {
          systemPrompt = mode.system_prompt || undefined;
        }
      }
    }

    // メッセージを取得
    const messagesRaw = db
      .prepare(`
        SELECT role, content, model, thinking
        FROM messages
        WHERE session_id = ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      .all(sessionId) as Array<{
        role: string;
        content: string;
        model?: string;
        thinking?: string;
      }>;

    // メッセージを復号
    const messages: Message[] = messagesRaw.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
      content: decrypt(msg.content),
      model: msg.model,
      thinking: msg.thinking ? decrypt(msg.thinking) : undefined,
    }));

    return {
      session,
      messages,
      systemPrompt,
      modeDisplayName,
      modeIcon,
    };
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
 * セッションのモデルを更新
 */
export function updateSessionModel(sessionId: number, modelName: string): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE sessions SET model = ?, updated_at = ? WHERE id = ?')
      .run(modelName, now, sessionId);

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
    // contentとthinkingを暗号化
    const encryptedContent = encrypt(content);
    const encryptedThinking = thinking ? encrypt(thinking) : null;

    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at, model, thinking) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, role, encryptedContent, now, model || null, encryptedThinking);

    // セッションの更新日時を更新
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

    // user-assistant のペアに変換
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

    if (messageIdsToDelete.length === 0) {
      return 0;
    }

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

    if (assistantMessages.length < 2) {
      return false;
    }

    const secondLastMessageId = assistantMessages[1].id;
    db.prepare('DELETE FROM messages WHERE id = ?').run(secondLastMessageId);

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

    if (!lastMessage) {
      return false;
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(lastMessage.id);

    return true;
  } finally {
    db.close();
  }
}

// ========================================
// ユーザー管理
// ========================================

/**
 * ユーザーを作成
 */
export function createUser(
  username: string,
  passwordHash: string,
  role: 'admin' | 'user' = 'user'
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(
        'INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(username, passwordHash, role, now, now);

    return result.lastInsertRowid as number;
  } finally {
    db.close();
  }
}

/**
 * ユーザー名でユーザーを取得
 */
export function getUserByUsername(username: string): User | null {
  const db = initDatabase();

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as User | undefined;

    return user || null;
  } finally {
    db.close();
  }
}

/**
 * IDでユーザーを取得
 */
export function getUserById(userId: number): User | null {
  const db = initDatabase();

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as User | undefined;

    return user || null;
  } finally {
    db.close();
  }
}

/**
 * すべてのユーザーを取得
 */
export function getAllUsers(): User[] {
  const db = initDatabase();

  try {
    const users = db
      .prepare('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC')
      .all() as User[];

    return users;
  } finally {
    db.close();
  }
}

/**
 * ユーザーのパスワードを更新
 */
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

/**
 * ユーザーを削除
 */
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

/**
 * リフレッシュトークンを保存
 */
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

/**
 * リフレッシュトークンを取得
 */
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

/**
 * リフレッシュトークンを削除
 */
export function deleteRefreshToken(token: string): boolean {
  const db = initDatabase();

  try {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * ユーザーのすべてのリフレッシュトークンを削除
 */
export function deleteAllRefreshTokensForUser(userId: number): number {
  const db = initDatabase();

  try {
    const result = db
      .prepare('DELETE FROM refresh_tokens WHERE user_id = ?')
      .run(userId);

    return result.changes;
  } finally {
    db.close();
  }
}

/**
 * 期限切れのリフレッシュトークンを削除
 */
export function cleanupExpiredRefreshTokens(): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(now);

    return result.changes;
  } finally {
    db.close();
  }
}
