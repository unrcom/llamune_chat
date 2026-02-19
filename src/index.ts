/**
 * Llamune_chat - ローカルLLMコーディング支援プラットフォーム
 */

import 'dotenv/config';
import { initDatabase, getAllPsetsTemplates } from './utils/database.js';
import app from './api/server.js';

const PORT = process.env.PORT || 3000;

console.log('🦙 Llamune_chat starting...');

// データベース初期化
console.log('📦 Initializing database...');
const db = initDatabase();
db.close();
console.log('✅ Database initialized');

// デフォルトテンプレートの確認
console.log('📋 Default parameter set templates:');
const templates = getAllPsetsTemplates();
templates.forEach(template => {
  console.log(`  ${template.icon} ${template.psets_name} (v${template.version})`);
});

// APIサーバー起動
app.listen(PORT, () => {
  console.log('');
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /api/health              - Health check');
  console.log('  POST /api/auth/register       - Register user');
  console.log('  POST /api/auth/login          - Login');
  console.log('  GET  /api/psets_template      - List parameter set templates');
  console.log('  GET  /api/models              - List Ollama models');
  console.log('  GET  /api/sessions            - List sessions');
  console.log('  POST /api/chat/send           - Send message');
  console.log('');
});
