/**
 * API クライアント
 */

const API_BASE = 'http://localhost:3000/api';

// トークン管理
let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken() {
  return accessToken;
}

/**
 * 認証付きfetch
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  let response = await fetch(url, { ...options, headers });
  
  // 401 の場合はトークンリフレッシュを試みる
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  // リフレッシュしても401の場合はログイン画面へ
  if (response.status === 401) {
    clearTokens();
    window.location.href = '/';
  }
  
  return response;
}

/**
 * トークンリフレッシュ
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      clearTokens();
      return false;
    }
    
    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// ========================================
// 認証 API
// ========================================

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }
  
  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function register(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }
  
  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  try {
    await authFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    clearTokens();
  }
}

export async function getMe() {
  const response = await authFetch(`${API_BASE}/auth/me`);
  if (!response.ok) {
    throw new Error('Not authenticated');
  }
  return (await response.json()).user;
}

// ========================================
// パラメータセットテンプレート API
// ========================================

export async function getPsetsTemplates(enabledOnly = true) {
  const query = enabledOnly ? '?enabled=1' : '';
  const response = await fetch(`${API_BASE}/psets_template${query}`);
  if (!response.ok) throw new Error('Failed to fetch psets templates');
  return (await response.json()).templates;
}

export async function getPsetsTemplate(id: number) {
  const response = await fetch(`${API_BASE}/psets_template/${id}`);
  if (!response.ok) throw new Error('Failed to fetch psets template');
  return (await response.json()).template;
}

export async function createPsetsTemplate(data: {
  visibility: 'public' | 'private';
  sort_order?: number;
  psets_name: string;
  icon?: string | null;
  description?: string | null;
  model?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  context_messages?: number | null;
  temperature?: number | null;
  top_p?: number | null;
}) {
  const response = await authFetch(`${API_BASE}/psets_template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create psets template');
  }
  return (await response.json()).template;
}

export async function updatePsetsTemplate(id: number, data: {
  visibility?: 'public' | 'private';
  sort_order?: number;
  psets_name?: string;
  icon?: string | null;
  description?: string | null;
  model?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  context_messages?: number | null;
  temperature?: number | null;
  top_p?: number | null;
  enabled?: number;
}) {
  const response = await authFetch(`${API_BASE}/psets_template/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update psets template');
  }
  return (await response.json()).template;
}

export async function disablePsetsTemplate(id: number) {
  const response = await authFetch(`${API_BASE}/psets_template/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to disable psets template');
  }
}

export async function copyPsetsTemplate(id: number) {
  const response = await authFetch(`${API_BASE}/psets_template/${id}/copy`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to copy psets template');
  }
  return (await response.json()).template;
}

export async function updatePsetsTemplateSortOrder(orders: { id: number; sort_order: number }[]) {
  const response = await authFetch(`${API_BASE}/psets_template/sort_order/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update sort order');
  }
}

// ========================================
// モデル API
// ========================================

export async function getModels() {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) throw new Error('Failed to fetch models');
  return (await response.json()).models;
}

// ========================================
// セッション API
// ========================================

export async function getSessions() {
  const response = await authFetch(`${API_BASE}/sessions`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return (await response.json()).sessions;
}

export async function createSession(templateId: number, projectPath?: string) {
  const response = await authFetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, projectPath }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return await response.json();
}

export async function getSession(id: number) {
  const response = await authFetch(`${API_BASE}/sessions/${id}`);
  if (!response.ok) throw new Error('Failed to fetch session');
  return await response.json();
}

export async function deleteSession(id: number) {
  const response = await authFetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete session');
}

export async function updateSessionTitle(id: number, title: string) {
  const response = await authFetch(`${API_BASE}/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to update session title');
  return await response.json();
}

export async function getSessionPsets(id: number) {
  const response = await authFetch(`${API_BASE}/sessions/${id}/psets`);
  if (!response.ok) throw new Error('Failed to fetch session psets');
  return (await response.json()).psets_current;
}

export async function updateSessionPsets(id: number, data: {
  psets_name?: string;
  icon?: string | null;
  description?: string | null;
  model?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  context_messages?: number | null;
  temperature?: number | null;
  top_p?: number | null;
  template_id?: number | null;
  template_version?: number | null;
}) {
  const response = await authFetch(`${API_BASE}/sessions/${id}/psets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update session psets');
  return (await response.json()).psets_current;
}

export async function exportSession(id: number): Promise<{ blob: Blob; filename: string }> {
  const response = await authFetch(`${API_BASE}/sessions/${id}/export`);
  if (!response.ok) throw new Error('Failed to export session');
  
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `llamune_chat_${id}.json`;
  if (contentDisposition) {
    const rfc5987Matches = /filename\*=UTF-8''([^;\s]+)/.exec(contentDisposition);
    if (rfc5987Matches && rfc5987Matches[1]) {
      filename = decodeURIComponent(rfc5987Matches[1]);
    } else {
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }
  }
  
  const blob = await response.blob();
  return { blob, filename };
}

// ========================================
// チャット API (ストリーミング)
// ========================================

export async function* sendMessage(
  sessionId: number,
  message: string,
  model?: string,
  signal?: AbortSignal
): AsyncGenerator<{ content: string; thinking?: string; model?: string; done: boolean }> {
  const response = await authFetch(`${API_BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, model }),
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

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
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            yield {
              content: parsed.content || '',
              thinking: parsed.thinking,
              model: parsed.model,
              done: parsed.done || false,
            };
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ========================================
// リトライ API
// ========================================

export async function* retryMessage(
  sessionId: number,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<{ content: string; thinking?: string; model: string; done: boolean }> {
  const response = await authFetch(`${API_BASE}/chat/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, model }),
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to retry message');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

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
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            yield {
              content: parsed.content || '',
              thinking: parsed.thinking,
              model: parsed.model || model,
              done: parsed.done || false,
            };
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function acceptRetry(sessionId: number): Promise<boolean> {
  const response = await authFetch(`${API_BASE}/chat/retry/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw new Error('Failed to accept retry');
  const data = await response.json();
  return data.success;
}

export async function rejectRetry(sessionId: number): Promise<boolean> {
  const response = await authFetch(`${API_BASE}/chat/retry/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw new Error('Failed to reject retry');
  const data = await response.json();
  return data.success;
}

export async function selectRetry(
  sessionId: number,
  adoptedIndex: number,
  keepIndices: number[] = [],
  discardIndices: number[] = []
): Promise<boolean> {
  const response = await authFetch(`${API_BASE}/chat/retry/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, adoptedIndex, keepIndices, discardIndices }),
  });
  if (!response.ok) throw new Error('Failed to select retry');
  const data = await response.json();
  return data.success;
}

// ========================================
// ファイルシステム API
// ========================================

export interface DirectoryNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
}

export async function getDirectoryTree(path?: string): Promise<DirectoryNode> {
  const url = path
    ? `${API_BASE}/filesystem/tree?path=${encodeURIComponent(path)}`
    : `${API_BASE}/filesystem/tree`;
  
  const response = await authFetch(url);
  if (!response.ok) throw new Error('Failed to fetch directory tree');
  return await response.json();
}

// ========================================
// フォルダ API
// ========================================

export async function getFolders() {
  const response = await authFetch(`${API_BASE}/folders`);
  if (!response.ok) throw new Error('Failed to fetch folders');
  return (await response.json()).folders;
}

export async function createFolder(data: { name: string; icon?: string | null; sort_order?: number }) {
  const response = await authFetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create folder');
  return (await response.json()).folder;
}

export async function updateFolder(id: number, data: { name?: string; icon?: string | null; sort_order?: number }) {
  const response = await authFetch(`${API_BASE}/folders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update folder');
}

export async function deleteFolder(id: number) {
  const response = await authFetch(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete folder');
}

export async function updateSessionFolder(folderId: number | null, sessionId: number) {
  const targetFolderId = folderId ?? 0;
  const response = await authFetch(`${API_BASE}/folders/${targetFolderId}/sessions/${sessionId}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error('Failed to update session folder');
}

export async function getTrashFolder() {
  const response = await authFetch(`${API_BASE}/folders/trash`);
  if (!response.ok) throw new Error('Failed to get trash folder');
  return (await response.json()).folder;
}

export async function hardDeleteSession(sessionId: number) {
  const response = await authFetch(`${API_BASE}/folders/trash/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to hard delete session');
}
