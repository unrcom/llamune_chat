/**
 * Ollama API クライアント
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';

/**
 * チャットメッセージの型
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

/**
 * ツール呼び出しの型
 */
export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * チャットリクエストのオプション
 */
export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: unknown[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_ctx?: number;
  };
}

/**
 * モデル情報の型
 */
export interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

/**
 * モデル一覧を取得
 */
export async function listModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }
  const data = await response.json();
  return data.models || [];
}

/**
 * チャット完了（非ストリーミング）
 */
export async function chat(options: ChatOptions): Promise<string> {
  const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: false,
      options: options.options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

/**
 * チャット完了（ストリーミング）
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<{
  content: string;
  thinking?: string;
  done: boolean;
}> {
  const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      options: options.options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullThinking = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            
            // 今回のチャンクの内容
            const chunkContent = data.message?.content || '';
            
            // 思考過程の抽出（Ollamaのmessage.thinkingフィールド対応）
            const chunkThinking = data.message?.thinking || '';

            // 累積
            fullContent += chunkContent;
            if (chunkThinking) {
              fullThinking += chunkThinking;
            }

            yield {
              content: fullContent,
              thinking: fullThinking || undefined,
              done: data.done || false,
            };
          } catch {
            // JSONパースエラーは無視
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * チャット完了（ストリーミング、ツール対応）
 */
export async function* chatStreamWithTools(options: ChatOptions): AsyncGenerator<{
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  done: boolean;
}> {
  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true,
    options: options.options,
  };

  // ツールが指定されている場合のみ追加
  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Chat stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullThinking = '';
  let toolCalls: ToolCall[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            
            // ツール呼び出しをチェック
            if (data.message?.tool_calls) {
              toolCalls = data.message.tool_calls;
            }
            
            // 今回のチャンクの内容
            const chunkContent = data.message?.content || '';
            
            // 思考過程の抽出
            const chunkThinking = data.message?.thinking || '';

            // 累積
            fullContent += chunkContent;
            if (chunkThinking) {
              fullThinking += chunkThinking;
            }

            yield {
              content: fullContent,
              thinking: fullThinking || undefined,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              done: data.done || false,
            };
          } catch {
            // JSONパースエラーは無視
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
