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
// モード API
// ========================================

export async function getModes() {
  const response = await fetch(`${API_BASE}/modes`);
  if (!response.ok) throw new Error('Failed to fetch modes');
  return (await response.json()).modes;
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

export async function createSession(model: string, modeId?: number, projectPath?: string) {
  const response = await authFetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, modeId, projectPath }),
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

// ========================================
// チャット API (ストリーミング)
// ========================================

export async function* sendMessage(
  sessionId: number,
  message: string,
  model?: string
): AsyncGenerator<{ content: string; thinking?: string; done: boolean }> {
  const response = await authFetch(`${API_BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, model }),
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
            // サーバーから累積されたcontentが来るので、そのまま渡す
            yield {
              content: parsed.content || '',
              thinking: parsed.thinking,
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
  model: string
): AsyncGenerator<{ content: string; thinking?: string; model: string; done: boolean }> {
  const response = await authFetch(`${API_BASE}/chat/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, model }),
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
