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
  name: string;
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
};

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  thinking?: string;
};
