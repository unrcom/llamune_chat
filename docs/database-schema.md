# Database Schema

## 概要

Llamune_chat のデータベーススキーマ設計書。
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

### 3. psets_template - パラメータセットテンプレート

ユーザーが作成・管理するパラメータセットのテンプレート（最新版）。
更新のたびに version が +1 され、psets_template_history に履歴が記録される。
削除は物理削除せず enabled = 0 で論理削除する。

```sql
CREATE TABLE psets_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'public' | 'private'
  sort_order INTEGER NOT NULL DEFAULT 100,
  psets_name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  model TEXT,
  system_prompt TEXT,
  max_tokens INTEGER,       -- 0: モデルのデフォルト
  context_messages INTEGER, -- 0: 無制限
  temperature REAL,
  top_p REAL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### 4. psets_template_history - パラメータセットテンプレート履歴

psets_template が更新されるたびに更新前の内容を insert する。
template_id + version で一意に識別できる。

```sql
CREATE TABLE psets_template_history (
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
```

### 5. psets_current - セッション別パラメータセット

セッション作成時に psets_template をコピーして insert する（seq=0）。
UI からパラメータが変更されるたびに seq++ して insert する。
sessions.psets_current_id が常に最新の seq を指す。

```sql
CREATE TABLE psets_current (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  template_id INTEGER,          -- 元テンプレートの id（テンプレートなしの場合は NULL）
  template_version INTEGER,     -- 元テンプレートの version
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
```

### 6. sessions - セッション

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  project_path TEXT,
  psets_current_id INTEGER,     -- 現在適用中の psets_current.id（最新 seq）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (psets_current_id) REFERENCES psets_current(id)
)
```

### 7. messages - メッセージ

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,       -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,    -- 暗号化済み
  model TEXT,
  thinking TEXT,            -- 暗号化済み（推論モデルの思考過程）
  is_adopted INTEGER DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
)
```

## パラメータ仕様

### スライダー範囲

| パラメータ | 範囲 | 備考 |
|---|---|---|
| `max_tokens` | 0〜8192 | 0: モデルのデフォルト |
| `context_messages` | 0〜50 | 0: 無制限 |
| `temperature` | 0.0〜1.0 | Ollama デフォルト: 0.8 |
| `top_p` | 0.0〜1.0 | Ollama デフォルト: 0.9 |

## セッション作成フロー

1. ユーザーが psets_template を選択してセッションを作成
2. 選択した psets_template の内容を psets_current に `seq=0` で insert
3. sessions に `psets_current_id` を設定して insert
4. UI からパラメータを変更するたびに psets_current に `seq++` で insert
5. sessions.psets_current_id を新しい psets_current.id に更新

## psets_template 更新フロー

1. ユーザーが psets_template を更新
2. 更新前の内容を psets_template_history に insert
3. psets_template の内容を更新し `version++`

## デフォルトテンプレート

初期化時に以下のデフォルトテンプレートを作成：

| psets_name | icon | visibility | model |
|---|---|---|---|
| あなたの本職を支援 | 💻 | public | （未指定） |
| 一般的な対話 | 🤖 | public | （未指定） |

## 主要な関数

### psets_template 関連

- `getAllPsetsTemplates()` - 全テンプレート取得（enabled=1）
- `getPsetsTemplateById(id)` - ID 指定で取得
- `createPsetsTemplate(...)` - テンプレート作成
- `updatePsetsTemplate(id, updates)` - テンプレート更新（履歴保存 + version++）
- `disablePsetsTemplate(id)` - 論理削除（enabled=0）

### psets_current 関連

- `createPsetsCurrent(sessionId, templateId, templateVersion, params)` - セッション作成時にコピー
- `updatePsetsCurrent(sessionId, updates)` - パラメータ変更（seq++ で insert）
- `getLatestPsetsCurrent(sessionId)` - セッションの最新パラメータ取得

### セッション関連

- `createSession(userId, psetsCurrentId, projectPath)` - セッション作成
- `listSessions(limit, userId)` - セッション一覧取得
- `getSession(sessionId, userId)` - セッション取得
- `updateSessionTitle(sessionId, title, userId)` - タイトル更新
- `updateSessionPsetsCurrent(sessionId, psetsCurrentId)` - パラメータ更新後に紐付け更新
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
