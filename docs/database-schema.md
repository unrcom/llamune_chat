# Database Schema

## 概要

Llamune のデータベーススキーマ設計書。
SQLite を使用し、シンプルで拡張性のある構造を目指す。

## テーブル一覧

### 1. users - ユーザー

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### 2. refresh_tokens - リフレッシュトークン

```sql
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  device_fingerprint TEXT,
  device_type TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### 3. modes - モード

```sql
CREATE TABLE modes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  system_prompt TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,  -- 1=デフォルト(削除不可), 0=ユーザー作成
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### 4. sessions - セッション

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  model TEXT NOT NULL,
  mode_id INTEGER,
  system_prompt_snapshot TEXT,  -- セッション作成時のシステムプロンプトのスナップショット
  title TEXT,
  project_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (mode_id) REFERENCES modes(id) ON DELETE SET NULL
)
```

### 5. messages - メッセージ

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,  -- 暗号化済み
  model TEXT,
  thinking TEXT,  -- 暗号化済み（推論モデルの思考過程）
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
)
```

## デフォルトモード

初期化時に以下のデフォルトモードを作成：

| name | display_name | description | icon | is_default |
|------|--------------|-------------|------|------------|
| professional | あなたの本職を支援 | コード生成の支援 | 💻 | 1 |
| general | 一般的な対話 | 一般的な対話と推論 | 🤖 | 1 |

## 主要な関数

### モード関連

- `getAllModes()` - 全モード取得
- `getModeById(id)` - ID指定でモード取得
- `getModeByName(name)` - 名前指定でモード取得
- `createMode(...)` - モード作成
- `updateMode(id, updates)` - モード更新
- `deleteMode(id)` - モード削除（is_default=0のみ）

### セッション関連

- `createSessionWithMode(model, userId, modeId, projectPath)` - セッション作成
- `listSessions(limit, userId)` - セッション一覧取得
- `getSession(sessionId, userId)` - セッション取得
- `updateSessionTitle(sessionId, title, userId)` - タイトル更新
- `updateSessionModel(sessionId, modelName)` - モデル更新
- `deleteSession(sessionId, userId)` - セッション削除

### メッセージ関連

- `saveMessage(sessionId, role, content, model, thinking)` - メッセージ保存
- `getSessionMessagesWithTurns(sessionId)` - ターン付きメッセージ取得
- `logicalDeleteMessagesAfterTurn(sessionId, turnNumber)` - 論理削除
- `deleteLastAssistantMessage(sessionId)` - 最後のアシスタントメッセージ削除

### ユーザー関連

- `createUser(username, passwordHash, role)` - ユーザー作成
- `getUserByUsername(username)` - ユーザー取得
- `getUserById(userId)` - ユーザー取得
- `getAllUsers()` - 全ユーザー取得
- `updateUserPassword(userId, newPasswordHash)` - パスワード更新
- `deleteUser(userId)` - ユーザー削除

### リフレッシュトークン関連

- `saveRefreshToken(userId, token, expiresAt, ...)` - トークン保存
- `getRefreshToken(token)` - トークン取得
- `deleteRefreshToken(token)` - トークン削除
- `deleteAllRefreshTokensForUser(userId)` - ユーザーの全トークン削除
- `cleanupExpiredRefreshTokens()` - 期限切れトークン削除
