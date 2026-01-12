# llamune

[![Status](https://img.shields.io/badge/status-development-orange)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

ローカルLLMを活用した、完全クローズド環境で動作するチャットプラットフォーム

> 📝 このリポジトリは [llamune_code](https://github.com/unrcom/llamune_code) のデータモデルを再設計した後継プロジェクトです。

## 🎯 概要

llamune は、機密情報を外部に送信せず、ローカルLLMでチャットできるプラットフォームです。

**主な特徴：**
- 🔒 **完全クローズド環境** - データは一切外部に送信されません
- 📁 **プロジェクトフォルダ統合** - ローカルディレクトリの読み取り・書き込み
- 🧠 **思考過程の可視化** - 推論モデルの思考プロセスを折りたたみ表示
- 🔐 **セキュア認証** - JWT認証によるユーザー管理
- 🤖 **複数LLM対応** - Ollama経由で様々なモデルに対応
- 📝 **Markdown対応** - チャット内容をMarkdownでレンダリング
- 📥 **エクスポート/インポート** - チャット履歴のバックアップと閲覧

## 🏗️ 開発ステータス

- [x] データベース設計・構築
- [x] API の実装と動作確認
- [x] CLI の実装と動作確認
- [x] Webブラウザアプリの実装と動作確認
- [x] Docker 化と動作確認

## 📋 必要要件

- Node.js 20+
- Ollama（ローカルLLM実行環境）
- Docker（Docker起動の場合）

## 🚀 クイックスタート

### Docker で起動（推奨）

> 📖 **詳細なセットアップガイド**: [docs/docker-setup-guide.md](docs/docker-setup-guide.md)
> 
> Ollama や Docker Desktop のインストール・起動確認から始める場合は、上記ガイドをご覧ください。

```bash
# リポジトリをクローン
git clone https://github.com/unrcom/llamune.git
cd llamune

# Ollamaをホストで起動しておく
ollama serve

# Dockerコンテナを起動
docker compose up --build
```

- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3000
- 初期ユーザー: `admin` / `admin`

### ローカルで起動

```bash
# リポジトリをクローン
git clone https://github.com/unrcom/llamune.git
cd llamune

# 依存関係をインストール
npm install
cd web && npm install && cd ..

# 環境変数を設定
cp .env.example .env
# .env を編集してJWT_SECRET等を設定

# ユーザーを作成
npm run dev:cli -- create-user <username> <password> <role>

# バックエンドを起動
npm run dev

# 別ターミナルでフロントエンドを起動
cd web
npm run dev
```

## 📁 プロジェクト構造

```
llamune/
├── src/
│   ├── api/           # REST API (Express)
│   │   ├── routes/    # APIルート
│   │   └── middleware/# 認証ミドルウェア
│   ├── utils/         # ユーティリティ（DB, Ollama）
│   ├── index.ts       # APIサーバーエントリポイント
│   └── cli.ts         # CLIツール
├── web/               # フロントエンド (React + Vite)
│   ├── src/
│   │   ├── components/# Reactコンポーネント
│   │   ├── api/       # APIクライアント
│   │   ├── hooks/     # カスタムフック
│   │   └── types/     # 型定義
│   └── Dockerfile     # フロントエンド用Dockerfile
├── scripts/           # ユーティリティスクリプト
├── docs/              # ドキュメント
├── docker-compose.yml # Docker Compose設定
├── Dockerfile.backend # バックエンド用Dockerfile
└── docker-entrypoint.sh # Docker初期化スクリプト
```

## 🔧 主な機能

### チャット機能
- Markdownレンダリング（コードブロック、テーブル等）
- 思考過程の折りたたみ表示（推論モデル対応）
- ストリーミングキャンセル（停止ボタン）
- リトライ機能（別モデルで再生成、比較ビュー）

### セッション管理
- セッション一覧（新しい順、メタ情報ツールチップ）
- タイトル編集
- エクスポート（JSON形式、日本語ファイル名対応）
- インポート（閲覧モード）

### モード機能
- 複数のシステムプロンプトを切り替え
- プロジェクトフォルダ指定（ファイル操作対応）

## 📄 ライセンス

MIT License
