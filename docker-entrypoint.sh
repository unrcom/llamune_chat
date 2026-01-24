#!/bin/bash
set -e

echo "🚀 Starting llamune backend setup..."

# .envファイルがない場合は作成
if [ ! -f .env ]; then
  echo "📝 Creating .env file from .env.example..."
  cp .env.example .env
  
  echo "🔑 Generating secrets..."
  node scripts/generate-secrets.js
fi

# Ollamaの起動を待つ
echo "⏳ Waiting for Ollama to be ready..."
until curl -s ${OLLAMA_API_URL}/api/tags > /dev/null 2>&1; do
  echo "   Ollama is not ready yet. Retrying in 10 seconds..."
  sleep 10
done
echo "✅ Ollama is ready!"

# データベースディレクトリの確認
echo "📁 Checking database directory..."
mkdir -p ~/.llamune

# adminユーザーの存在確認と作成
echo "👤 Checking for admin user..."
if npm run dev:cli -- create-user admin admin admin 2>&1 | grep -q "already exists"; then
  echo "✅ Admin user already exists"
else
  echo "✅ Admin user created (username: admin, password: admin)"
fi

echo "🎉 Setup complete! Starting API server..."
echo ""

# 渡されたコマンドを実行
exec "$@"
