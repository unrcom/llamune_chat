/**
 * 型定義
 */

export type Folder = {
  id: number;
  user_id: number | null;
  name: string;
  icon: string | null;
  sort_order: number;
  is_trash: number;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: number;
  username: string;
  role: 'admin' | 'user';
};

export type PsetsTemplate = {
  id: number;
  version: number;
  visibility: 'public' | 'private';
  sort_order: number;
  psets_name: string;
  icon: string | null;
  description: string | null;
  model: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  context_messages: number | null;
  temperature: number | null;
  top_p: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type PsetsCurrent = {
  id: number;
  session_id: number;
  template_id: number | null;
  template_version: number | null;
  seq: number;
  psets_name: string;
  icon: string | null;
  description: string | null;
  model: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  context_messages: number | null;
  temperature: number | null;
  top_p: number | null;
  created_at: string;
};

export type Model = {
  name: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
};

export type Session = {
  id: number;
  title: string | null;
  message_count: number;
  preview: string | null;
  created_at: string;
  updated_at: string;
  psets_name?: string;
  psets_icon?: string;
  model?: string;
  project_path?: string;
  folder_id?: number | null;
};

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  thinking?: string;
  is_adopted?: boolean;
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
    psetsName?: string | null;
    psetsIcon?: string | null;
  };
  messages: {
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    thinking?: string;
    is_adopted?: boolean;
  }[];
};
