# Llamune

[![Status](https://img.shields.io/badge/status-development-orange)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

ローカルLLMを活用した、完全クローズド環境で動作するコーディング支援プラットフォーム

> 📝 このリポジトリは [llamune_code](https://github.com/unrcom/llamune_code) のデータモデルを再設計した後継プロジェクトです。

## 🎯 概要

Llamune は、機密情報を外部に送信せず、ローカルLLMでコーディング支援を受けられるプラットフォームです。

**主な特徴：**
- 🔒 **完全クローズド環境** - データは一切外部に送信されません
- 📁 **プロジェクト統合** - ローカルディレクトリに直接アクセス
- 🧠 **思考過程の可視化** - 推論モデルの思考プロセスを表示
- 🔐 **エンドツーエンド暗号化** - AES-256-GCMで会話内容を保護
- 🤖 **複数LLM対応** - Ollama経由で様々なモデルに対応

## 🏗️ 開発ステータス

- [x] データベース設計
- [ ] データベース構築
- [ ] API の実装と動作確認
- [ ] CLI の実装と動作確認
- [ ] Webブラウザアプリの実装と動作確認
- [ ] Docker 化と動作確認

## 📋 必要要件

- Node.js 20+
- Ollama（ローカルLLM実行環境）
- SQLite

## 🚀 クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/unrcom/llamune.git
cd llamune

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## 📁 プロジェクト構造

```
llamune/
├── src/
│   ├── api/          # REST API
│   ├── core/         # コアロジック
│   └── utils/        # ユーティリティ
├── web/              # フロントエンド (React)
├── docs/             # ドキュメント
└── tests/            # テスト
```

## 📄 ライセンス

MIT License
