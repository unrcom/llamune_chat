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
}

/**
 * チャットリクエストのオプション
 */
export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
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
            
            // 思考過程の抽出（<think>タグ対応）
            const content = data.message?.content || '';
            let thinking: string | undefined;
            let cleanContent = content;

            // <think>タグがある場合は分離
            const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              thinking = thinkMatch[1];
              cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            }

            yield {
              content: cleanContent,
              thinking,
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
