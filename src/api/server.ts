/**
 * API サーバー
 */

import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.js';
import modesRouter from './routes/modes.js';
import sessionsRouter from './routes/sessions.js';
import chatRouter from './routes/chat.js';
import modelsRouter from './routes/models.js';
import filesystemRouter from './routes/filesystem.js';

const app = express();

// ミドルウェア
app.use(cors());
app.use(express.json());

// リクエストログ
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ルート
app.use('/api/auth', authRouter);
app.use('/api/modes', modesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/models', modelsRouter);
app.use('/api/filesystem', filesystemRouter);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// エラーハンドラー
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

export default app;
