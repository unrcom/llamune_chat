/**
 * 型定義
 */

export type User = {
  id: number;
  username: string;
  role: 'admin' | 'user';
};

export type Mode = {
  id: number;
  display_name: string;
  description: string | null;
  icon: string | null;
  system_prompt: string | null;
  is_default: number;
};

export type Model = {
  name: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
};

export type Session = {
  id: number;
  model: string;
  title: string | null;
  message_count: number;
  preview: string | null;
  created_at: string;
  updated_at: string;
  mode_display_name?: string;
  mode_icon?: string;
  project_path?: string;
};

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  thinking?: string;
};

// インポート用の型
export type ImportedSession = {
  version: string;
  exportedAt: string;
  session: {
    id: number;
    title: string | null;
    model: string;
    created_at: string;
    updated_at?: string;
    project_path?: string | null;
    systemPrompt?: string | null;
  };
  messages: {
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    thinking?: string;
  }[];
};
