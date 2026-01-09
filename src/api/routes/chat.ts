/**
 * チャット API ルート
 */

import { Router, Response } from 'express';
import {
  getSession,
  saveMessage,
  updateSessionModel,
  deleteLastAssistantMessage,
  deleteSecondLastAssistantMessage,
} from '../../utils/database.js';
import { chatStream, ChatMessage } from '../../utils/ollama.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/chat/send - メッセージ送信（ストリーミング）
 */
router.post('/send', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, message, model } = req.body;

    // バリデーション
    if (!sessionId || !message) {
      res.status(400).json({ error: 'Session ID and message are required', code: 'VALIDATION_ERROR' });
      return;
    }

    // セッション取得
    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    // モデルが指定されていれば更新
    const currentModel = model || sessionData.session.model;
    if (model && model !== sessionData.session.model) {
      updateSessionModel(sessionId, model);
    }

    // ユーザーメッセージを保存
    saveMessage(sessionId, 'user', message);

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [];
    
    // システムプロンプト
    if (sessionData.systemPrompt) {
      messages.push({ role: 'system', content: sessionData.systemPrompt });
    }

    // 過去のメッセージ
    for (const msg of sessionData.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // 新しいユーザーメッセージ
    messages.push({ role: 'user', content: message });

    // SSEヘッダー設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ストリーミングレスポンス
    let fullContent = '';
    let fullThinking = '';

    try {
      for await (const chunk of chatStream({ model: currentModel, messages })) {
        // chatStreamは既に累積されたcontentを返すので、そのまま使用
        fullContent = chunk.content;
        if (chunk.thinking) {
          fullThinking = chunk.thinking;
        }

        // SSEイベント送信
        const eventData = JSON.stringify({
          content: fullContent,
          thinking: fullThinking || undefined,
          done: chunk.done,
        });
        res.write(`data: ${eventData}\n\n`);

        if (chunk.done) {
          break;
        }
      }

      // アシスタントメッセージを保存
      saveMessage(sessionId, 'assistant', fullContent, currentModel, fullThinking || undefined);

      res.write('data: [DONE]\n\n');
    } catch (streamError) {
      console.error('Stream error:', streamError);
      const errorData = JSON.stringify({ error: 'Stream failed', code: 'STREAM_ERROR' });
      res.write(`data: ${errorData}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat send error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message', code: 'INTERNAL_ERROR' });
    }
  }
});

/**
 * POST /api/chat/retry - リトライ（最後のアシスタントメッセージを削除して再生成）
 */
router.post('/retry', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, model } = req.body;

    // バリデーション
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // セッション取得
    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    // 最後のアシスタントメッセージを削除
    deleteLastAssistantMessage(sessionId);

    // モデルが指定されていれば更新
    const currentModel = model || sessionData.session.model;

    // メッセージ履歴を再構築
    const updatedSessionData = getSession(sessionId, req.user?.userId);
    if (!updatedSessionData) {
      res.status(500).json({ error: 'Failed to get session', code: 'INTERNAL_ERROR' });
      return;
    }

    const messages: ChatMessage[] = [];
    
    if (updatedSessionData.systemPrompt) {
      messages.push({ role: 'system', content: updatedSessionData.systemPrompt });
    }

    for (const msg of updatedSessionData.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // SSEヘッダー設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ストリーミングレスポンス
    let fullContent = '';
    let fullThinking = '';

    try {
      for await (const chunk of chatStream({ model: currentModel, messages })) {
        // chatStreamは既に累積されたcontentを返すので、そのまま使用
        fullContent = chunk.content;
        if (chunk.thinking) {
          fullThinking = chunk.thinking;
        }

        const eventData = JSON.stringify({
          content: fullContent,
          thinking: fullThinking || undefined,
          done: chunk.done,
        });
        res.write(`data: ${eventData}\n\n`);

        if (chunk.done) {
          break;
        }
      }

      // アシスタントメッセージを保存
      saveMessage(sessionId, 'assistant', fullContent, currentModel, fullThinking || undefined);

      res.write('data: [DONE]\n\n');
    } catch (streamError) {
      console.error('Stream error:', streamError);
      const errorData = JSON.stringify({ error: 'Stream failed', code: 'STREAM_ERROR' });
      res.write(`data: ${errorData}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat retry error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to retry', code: 'INTERNAL_ERROR' });
    }
  }
});

export default router;
