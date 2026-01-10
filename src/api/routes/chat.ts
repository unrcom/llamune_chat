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
import { chatStream, chatStreamWithTools, ChatMessage, ToolCall } from '../../utils/ollama.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { projectTools, executeToolCall, generateFileTree } from '../../utils/project-tools.js';

const router = Router();

/**
 * プロジェクトパス用のシステムプロンプト補足を生成
 */
function getProjectSystemPromptAddition(projectPath: string): string {
  const fileTree = generateFileTree(projectPath);
  return `\n\n## プロジェクト構造\n\nあなたは以下のプロジェクトディレクトリにアクセスできます：\n\`\`\`\n${fileTree}\n\`\`\`\n\nファイルを読み取る場合は read_file ツールを、ディレクトリ一覧を取得する場合は list_files ツールを使用してください。`;
}

/**
 * ツール呼び出しを処理してLLMを再呼び出し
 */
async function* processToolCallsAndContinue(
  model: string,
  messages: ChatMessage[],
  toolCalls: ToolCall[],
  projectPath: string,
  res: Response
): AsyncGenerator<{ content: string; thinking?: string; done: boolean }> {
  // アシスタントメッセージ（ツール呼び出し含む）を追加
  messages.push({
    role: 'assistant',
    content: '',
    tool_calls: toolCalls,
  });

  // ツールを実行
  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    const toolArgs = toolCall.function.arguments;
    
    console.log(`🔧 Executing tool: ${toolName}`, toolArgs);
    
    const toolResult = executeToolCall(projectPath, toolName, toolArgs);
    
    console.log(`📄 Tool result (first 200 chars): ${toolResult.substring(0, 200)}...`);

    // ツール結果をメッセージに追加
    messages.push({
      role: 'tool',
      content: toolResult,
    });
  }

  // ツール結果を含めて再度LLMを呼び出し
  let fullContent = '';
  let fullThinking = '';
  let newToolCalls: ToolCall[] = [];

  for await (const chunk of chatStreamWithTools({ model, messages, tools: projectTools })) {
    fullContent = chunk.content;
    if (chunk.thinking) {
      fullThinking = chunk.thinking;
    }
    if (chunk.toolCalls) {
      newToolCalls = chunk.toolCalls;
    }

    // SSEイベント送信
    const eventData = JSON.stringify({
      content: fullContent,
      thinking: fullThinking || undefined,
      done: chunk.done && newToolCalls.length === 0,
    });
    res.write(`data: ${eventData}\n\n`);
  }

  // 再帰的にツール呼び出しを処理（最大5回まで）
  if (newToolCalls.length > 0) {
    yield* processToolCallsAndContinue(model, messages, newToolCalls, projectPath, res);
  } else {
    yield {
      content: fullContent,
      thinking: fullThinking || undefined,
      done: true,
    };
  }
}

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

    // プロジェクトパスを取得
    const projectPath = sessionData.session.project_path || null;

    // ユーザーメッセージを保存
    saveMessage(sessionId, 'user', message);

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [];
    
    // システムプロンプト（プロジェクトパスがある場合は補足を追加）
    if (sessionData.systemPrompt) {
      let systemPrompt = sessionData.systemPrompt;
      if (projectPath) {
        systemPrompt += getProjectSystemPromptAddition(projectPath);
      }
      messages.push({ role: 'system', content: systemPrompt });
    } else if (projectPath) {
      // システムプロンプトがなくてもプロジェクト情報は追加
      messages.push({ role: 'system', content: getProjectSystemPromptAddition(projectPath) });
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
      if (projectPath) {
        // プロジェクトパスがある場合はツール対応版を使用
        console.log('🔧 Tools enabled for project:', projectPath);
        
        let toolCalls: ToolCall[] = [];
        
        for await (const chunk of chatStreamWithTools({ model: currentModel, messages, tools: projectTools })) {
          fullContent = chunk.content;
          if (chunk.thinking) {
            fullThinking = chunk.thinking;
          }
          if (chunk.toolCalls) {
            toolCalls = chunk.toolCalls;
          }

          // ツール呼び出しがない場合のみSSE送信
          if (!chunk.toolCalls || chunk.toolCalls.length === 0) {
            const eventData = JSON.stringify({
              content: fullContent,
              thinking: fullThinking || undefined,
              done: chunk.done,
            });
            res.write(`data: ${eventData}\n\n`);
          }
        }

        // ツール呼び出しがある場合は処理
        if (toolCalls.length > 0) {
          for await (const result of processToolCallsAndContinue(currentModel, messages, toolCalls, projectPath, res)) {
            fullContent = result.content;
            if (result.thinking) {
              fullThinking = result.thinking;
            }
          }
        }
      } else {
        // プロジェクトパスがない場合は通常のストリーミング
        for await (const chunk of chatStream({ model: currentModel, messages })) {
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
 * POST /api/chat/retry - リトライ（最後のアシスタントメッセージを削除せずに再生成）
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

    // リトライ用のモデル（指定がなければセッションのモデル）
    const retryModel = model || sessionData.session.model;

    // プロジェクトパスを取得
    const projectPath = sessionData.session.project_path || null;

    // メッセージ履歴を構築（最後のアシスタントメッセージを除く）
    const messages: ChatMessage[] = [];
    
    // システムプロンプト
    if (sessionData.systemPrompt) {
      let systemPrompt = sessionData.systemPrompt;
      if (projectPath) {
        systemPrompt += getProjectSystemPromptAddition(projectPath);
      }
      messages.push({ role: 'system', content: systemPrompt });
    } else if (projectPath) {
      messages.push({ role: 'system', content: getProjectSystemPromptAddition(projectPath) });
    }

    // 最後のアシスタントメッセージを除外してメッセージを構築
    const messagesWithoutLastAssistant = [...sessionData.messages];
    for (let i = messagesWithoutLastAssistant.length - 1; i >= 0; i--) {
      if (messagesWithoutLastAssistant[i].role === 'assistant') {
        messagesWithoutLastAssistant.splice(i, 1);
        break;
      }
    }

    for (const msg of messagesWithoutLastAssistant) {
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
      if (projectPath) {
        // プロジェクトパスがある場合はツール対応版を使用
        let toolCalls: ToolCall[] = [];
        
        for await (const chunk of chatStreamWithTools({ model: retryModel, messages, tools: projectTools })) {
          fullContent = chunk.content;
          if (chunk.thinking) {
            fullThinking = chunk.thinking;
          }
          if (chunk.toolCalls) {
            toolCalls = chunk.toolCalls;
          }

          if (!chunk.toolCalls || chunk.toolCalls.length === 0) {
            const eventData = JSON.stringify({
              content: fullContent,
              thinking: fullThinking || undefined,
              done: chunk.done,
              model: retryModel,
            });
            res.write(`data: ${eventData}\n\n`);
          }
        }

        if (toolCalls.length > 0) {
          for await (const result of processToolCallsAndContinue(retryModel, messages, toolCalls, projectPath, res)) {
            fullContent = result.content;
            if (result.thinking) {
              fullThinking = result.thinking;
            }
          }
        }
      } else {
        for await (const chunk of chatStream({ model: retryModel, messages })) {
          fullContent = chunk.content;
          if (chunk.thinking) {
            fullThinking = chunk.thinking;
          }

          const eventData = JSON.stringify({
            content: fullContent,
            thinking: fullThinking || undefined,
            done: chunk.done,
            model: retryModel,
          });
          res.write(`data: ${eventData}\n\n`);

          if (chunk.done) {
            break;
          }
        }
      }

      // リトライの回答を保存（元の回答は残したまま）
      saveMessage(sessionId, 'assistant', fullContent, retryModel, fullThinking || undefined);

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

/**
 * POST /api/chat/retry/accept - リトライ回答を採用（元の回答を削除）
 */
router.post('/retry/accept', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // セッション所有者チェック
    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    // 最後から2番目のアシスタントメッセージを削除（元の回答）
    const success = deleteSecondLastAssistantMessage(sessionId);
    
    res.json({ success, sessionId });
  } catch (error) {
    console.error('Accept retry error:', error);
    res.status(500).json({ error: 'Failed to accept retry', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/chat/retry/reject - リトライ回答を破棄（新しい回答を削除）
 */
router.post('/retry/reject', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required', code: 'VALIDATION_ERROR' });
      return;
    }

    // セッション所有者チェック
    const sessionData = getSession(sessionId, req.user?.userId);
    if (!sessionData) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    // 最後のアシスタントメッセージを削除（リトライ回答）
    const success = deleteLastAssistantMessage(sessionId);
    
    res.json({ success, sessionId });
  } catch (error) {
    console.error('Reject retry error:', error);
    res.status(500).json({ error: 'Failed to reject retry', code: 'INTERNAL_ERROR' });
  }
});

export default router;
