/**
 * llamune_monkey 連携ユーティリティ
 * 登録・解除・状態通知を担う
 */

import 'dotenv/config';

export const MONKEY_URL = process.env.MONKEY_URL ?? '';
export const INSTANCE_ID = process.env.INSTANCE_ID ?? 'llamune_chat';
const INSTANCE_DESCRIPTION = process.env.INSTANCE_DESCRIPTION ?? INSTANCE_ID;
const SELF_URL = process.env.SELF_URL ?? 'http://localhost:3000';

export type ModelStatus = 'idle' | 'loading' | 'inferring';

async function monkeyFetch(path: string, options: RequestInit): Promise<void> {
  if (!MONKEY_URL) return;
  try {
    await fetch(`${MONKEY_URL}${path}`, {
      ...options,
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn(`⚠️  monkey request failed (${path}):`, e);
  }
}

export async function registerToMonkey(): Promise<void> {
  if (!MONKEY_URL) return;
  await monkeyFetch('/api/registry/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: INSTANCE_ID,
      url: SELF_URL,
      description: INSTANCE_DESCRIPTION,
    }),
  });
  console.log(`✅ Registered to monkey: ${INSTANCE_ID}`);
}

export async function unregisterFromMonkey(): Promise<void> {
  if (!MONKEY_URL) return;
  await monkeyFetch(`/api/registry/${INSTANCE_ID}`, { method: 'DELETE' });
  console.log(`🗑️  Unregistered from monkey: ${INSTANCE_ID}`);
}

export async function notifyMonkeyStatus(
  model_status: ModelStatus,
  current_model?: string | null,
  queue_size?: number
): Promise<void> {
  if (!MONKEY_URL) return;
  await monkeyFetch(`/api/registry/${INSTANCE_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_status,
      current_model: current_model ?? null,
      queue_size: queue_size ?? 0,
    }),
  });
}
