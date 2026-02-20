# Database Schema

## 概要

llamune_chat のデータベーススキーマ設計書。
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

LLMのパラメータセットを管理するテンプレートテーブル。
テンプレートを更新するとバージョンが上がり、履歴が `psets_template_history` に保存される。

```sql
CREATE TABLE psets_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'public' | 'private'
  sort_order INTEGER NOT NULL DEFAULT 0,
  psets_name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  model TEXT,
  system_prompt TEXT,
  max_tokens INTEGER,
  context_messages INTEGER NOT NULL DEFAULT 10,
  temperature REAL NOT NULL DEFAULT 0.8,
  top_p REAL NOT NULL DEFAULT 0.9,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

**デフォルトテンプレート（初期化時に作成）:**

| psets_name | icon | description | visibility |
|------------|------|-------------|------------|
| あなたの本職を支援 | 💻 | コード生成支援 | private |
| 一般的な対話 | 🤖 | 一般対話 | private |

### 4. psets_template_history - パラメータセットテンプレート履歴

`psets_template` の更新履歴。テンプレート更新時に旧バージョンをここに保存する。

```sql
CREATE TABLE psets_template_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  psets_name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  model TEXT,
  system_prompt TEXT,
  max_tokens INTEGER,
  context_messages INTEGER NOT NULL,
  temperature REAL NOT NULL,
  top_p REAL NOT NULL,
  archived_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES psets_template(id) ON DELETE CASCADE
)
```

### 5. psets_current - セッションの現在のパラメータセット

各セッションが実際に使用しているパラメータセット。
セッション作成時にテンプレートからコピーされ、セッションごとに独立して管理される。
パラメータを変更するたびに `seq` が増加し、新しいレコードが追加される（履歴として保持）。

```sql
CREATE TABLE psets_current (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  template_id INTEGER,            -- 元テンプレートID（カスタム変更時はNULL）
  template_version INTEGER,       -- 元テンプレートのバージョン
  seq INTEGER NOT NULL DEFAULT 0, -- 変更シーケンス番号（0始まり）
  psets_name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  model TEXT,
  system_prompt TEXT,
  max_tokens INTEGER,
  context_messages INTEGER NOT NULL DEFAULT 10,
  temperature REAL NOT NULL DEFAULT 0.8,
  top_p REAL NOT NULL DEFAULT 0.9,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES psets_template(id) ON DELETE SET NULL
)
```

### 6. sessions - セッション

チャットセッションを管理するテーブル。
`psets_current_id` は最新の `psets_current` レコードを指す。

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  project_path TEXT,
  psets_current_id INTEGER,  -- 最新のpsets_currentへの参照
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (psets_current_id) REFERENCES psets_current(id) ON DELETE SET NULL
)
```

### 7. messages - メッセージ

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,     -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,  -- AES-256-GCM暗号化済み
  model TEXT,             -- 実際に使用したモデル名
  thinking TEXT,          -- AES-256-GCM暗号化済み（推論モデルの思考過程）
  is_adopted INTEGER,     -- リトライ選択結果: 1=採用, 0=履歴のみ保持, NULL=通常
  deleted_at TEXT,        -- 論理削除日時
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
)
```

## テーブル関連図

```
users
  └── refresh_tokens (user_id)
  └── sessions (user_id)
        └── psets_current (session_id)  ←── psets_template (template_id)
        │     └── [seq履歴として複数レコード保持]           │
        │                                                    └── psets_template_history
        └── messages (session_id)
```

## 主要な関数

### パラメータセットテンプレート関連

- `getAllPsetsTemplates()` - 全テンプレート取得（sort_order順）
- `getPsetsTemplateById(id)` - ID指定でテンプレート取得
- `createPsetsTemplate(data)` - テンプレート作成
- `updatePsetsTemplate(id, updates)` - テンプレート更新（バージョン++、旧バージョンをhistoryに保存）
- `disablePsetsTemplate(id)` - テンプレート無効化（enabled=0）
- `copyPsetsTemplate(id)` - テンプレートのコピー作成
- `updatePsetsTemplateSortOrder(orders)` - 表示順一括更新

### psets_current 関連

- `createPsetsCurrent(sessionId, template)` - セッション作成時にテンプレートからpsets_currentを作成
- `updatePsetsCurrent(sessionId, updates)` - パラメータ更新（seq++して新レコード追加）
- `getLatestPsetsCurrent(sessionId)` - セッションの最新psets_currentを取得

### セッション関連

- `createSession(templateId, userId, projectPath, modelOverride)` - セッション作成
- `listSessions(limit, userId)` - セッション一覧取得（psets情報含む）
- `getSession(sessionId, userId)` - セッション取得（psets情報・メッセージ含む）
- `updateSessionTitle(sessionId, title)` - タイトル更新
- `deleteSession(sessionId, userId)` - セッション削除

### メッセージ関連

- `saveMessage(sessionId, role, content, model, thinking)` - メッセージ保存（暗号化）
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
