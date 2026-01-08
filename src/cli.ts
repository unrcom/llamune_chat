#!/usr/bin/env node
/**
 * Llamune CLI
 */

import 'dotenv/config';
import readline from 'readline';
import {
  initDatabase,
  getAllModes,
  createSession,
  getSession,
  listSessions,
  saveMessage,
  deleteLastAssistantMessage,
} from './utils/database.js';
import { listModels, chatStream, ChatMessage } from './utils/ollama.js';

// 色付き出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// 現在のセッション情報
let currentSessionId: number | null = null;
let currentModel: string = '';
let currentModeId: number | null = null;
let systemPrompt: string | undefined;

// readline インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * プロンプトを表示して入力を待つ
 */
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * 選択肢から選ぶ
 */
async function select<T>(
  message: string,
  options: { label: string; value: T }[]
): Promise<T> {
  console.log(`\n${colors.cyan}${message}${colors.reset}`);
  options.forEach((opt, i) => {
    console.log(`  ${colors.yellow}${i + 1}${colors.reset}) ${opt.label}`);
  });

  while (true) {
    const input = await prompt(`${colors.dim}選択 (1-${options.length}): ${colors.reset}`);
    const index = parseInt(input, 10) - 1;
    if (index >= 0 && index < options.length) {
      return options[index].value;
    }
    console.log(`${colors.yellow}1-${options.length} の数字を入力してください${colors.reset}`);
  }
}

/**
 * モデル選択
 */
async function selectModel(): Promise<string> {
  console.log(`\n${colors.dim}モデル一覧を取得中...${colors.reset}`);
  
  try {
    const models = await listModels();
    if (models.length === 0) {
      console.log(`${colors.yellow}利用可能なモデルがありません。Ollama でモデルをダウンロードしてください。${colors.reset}`);
      process.exit(1);
    }

    const options = models.map((m) => ({
      label: `${m.name} (${formatSize(m.size)})`,
      value: m.name,
    }));

    return await select('モデルを選択してください:', options);
  } catch (error) {
    console.error(`${colors.yellow}Ollama に接続できません。Ollama が起動しているか確認してください。${colors.reset}`);
    process.exit(1);
  }
}

/**
 * モード選択
 */
async function selectMode(): Promise<{ id: number; systemPrompt: string | null }> {
  const modes = getAllModes();
  const options = modes.map((m) => ({
    label: `${m.icon} ${m.display_name}`,
    value: { id: m.id, systemPrompt: m.system_prompt },
  }));

  return await select('モードを選択してください:', options);
}

/**
 * セッション選択または新規作成
 */
async function selectOrCreateSession(): Promise<void> {
  const sessions = listSessions(10);
  
  const options: { label: string; value: number | null }[] = [
    { label: '🆕 新しいチャットを開始', value: null },
  ];

  sessions.reverse().forEach((s) => {
    const title = s.title || '(無題)';
    const preview = title.length > 30 ? title.substring(0, 30) + '...' : title;
    options.push({ label: `📝 ${preview}`, value: s.id });
  });

  const sessionId = await select('セッションを選択してください:', options);

  if (sessionId === null) {
    // 新規セッション
    currentModel = await selectModel();
    const mode = await selectMode();
    currentModeId = mode.id;
    systemPrompt = mode.systemPrompt || undefined;
    currentSessionId = createSession(currentModel, undefined, currentModeId);
    console.log(`\n${colors.green}✨ 新しいチャットを開始しました${colors.reset}`);
  } else {
    // 既存セッション
    currentSessionId = sessionId;
    const sessionData = getSession(sessionId);
    if (sessionData) {
      currentModel = sessionData.session.model;
      currentModeId = sessionData.session.mode_id;
      systemPrompt = sessionData.systemPrompt;
      
      console.log(`\n${colors.green}📂 セッションを読み込みました${colors.reset}`);
      console.log(`${colors.dim}モデル: ${currentModel}${colors.reset}`);
      
      // 過去のメッセージを表示
      if (sessionData.messages.length > 0) {
        console.log(`\n${colors.dim}--- 過去の会話 ---${colors.reset}`);
        sessionData.messages.forEach((msg) => {
          if (msg.role === 'user') {
            console.log(`\n${colors.cyan}You:${colors.reset} ${msg.content}`);
          } else if (msg.role === 'assistant') {
            console.log(`\n${colors.green}AI:${colors.reset} ${msg.content}`);
          }
        });
        console.log(`${colors.dim}--- ここから続き ---${colors.reset}\n`);
      }
    }
  }
}

/**
 * チャットメッセージを送信
 */
async function sendMessage(userMessage: string): Promise<void> {
  if (!currentSessionId) return;

  // ユーザーメッセージを保存
  saveMessage(currentSessionId, 'user', userMessage);

  // メッセージ履歴を構築
  const sessionData = getSession(currentSessionId);
  if (!sessionData) return;

  const messages: ChatMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of sessionData.messages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // ストリーミングレスポンス
  process.stdout.write(`\n${colors.green}AI:${colors.reset} `);
  
  let fullContent = '';
  let fullThinking = '';
  let lastContentLength = 0;
  let lastThinkingLength = 0;

  try {
    for await (const chunk of chatStream({ model: currentModel, messages })) {
      // 思考過程の表示（あれば、差分のみ）
      if (chunk.thinking && chunk.thinking.length > lastThinkingLength) {
        const newThinking = chunk.thinking.slice(lastThinkingLength);
        process.stdout.write(`${colors.gray}${newThinking}${colors.reset}`);
        lastThinkingLength = chunk.thinking.length;
      }

      // コンテンツの表示（差分のみ）
      if (chunk.content.length > lastContentLength) {
        const newContent = chunk.content.slice(lastContentLength);
        process.stdout.write(newContent);
        lastContentLength = chunk.content.length;
      }

      fullContent = chunk.content;
      fullThinking = chunk.thinking || '';
    }

    console.log('\n');

    // アシスタントメッセージを保存
    saveMessage(currentSessionId, 'assistant', fullContent, currentModel, fullThinking || undefined);
  } catch (error) {
    console.error(`\n${colors.yellow}エラー: メッセージの送信に失敗しました${colors.reset}`);
    console.error(error);
  }
}

/**
 * ファイルサイズをフォーマット
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * ヘルプを表示
 */
function showHelp(): void {
  console.log(`
${colors.cyan}コマンド:${colors.reset}
  ${colors.yellow}/new${colors.reset}      - 新しいチャットを開始
  ${colors.yellow}/model${colors.reset}    - モデルを変更
  ${colors.yellow}/sessions${colors.reset} - セッション一覧
  ${colors.yellow}/retry${colors.reset}    - 最後の応答を再生成
  ${colors.yellow}/help${colors.reset}     - このヘルプを表示
  ${colors.yellow}/quit${colors.reset}     - 終了
`);
}

/**
 * メインループ
 */
async function main(): Promise<void> {
  console.log(`
${colors.bright}${colors.cyan}🦙 Llamune CLI${colors.reset}
${colors.dim}ローカルLLMコーディング支援${colors.reset}
`);

  // データベース初期化
  const db = initDatabase();
  db.close();

  // セッション選択
  await selectOrCreateSession();

  showHelp();

  // チャットループ
  while (true) {
    const input = await prompt(`${colors.cyan}You:${colors.reset} `);

    if (!input) continue;

    // コマンド処理
    if (input.startsWith('/')) {
      const command = input.toLowerCase();

      if (command === '/quit' || command === '/exit' || command === '/q') {
        console.log(`\n${colors.dim}👋 さようなら！${colors.reset}\n`);
        rl.close();
        process.exit(0);
      }

      if (command === '/help' || command === '/h') {
        showHelp();
        continue;
      }

      if (command === '/new') {
        await selectOrCreateSession();
        continue;
      }

      if (command === '/model') {
        currentModel = await selectModel();
        console.log(`${colors.green}✅ モデルを ${currentModel} に変更しました${colors.reset}`);
        continue;
      }

      if (command === '/sessions') {
        await selectOrCreateSession();
        continue;
      }

      if (command === '/retry') {
        if (currentSessionId) {
          const sessionData = getSession(currentSessionId);
          if (sessionData && sessionData.messages.length > 0) {
            // 最後のユーザーメッセージを取得
            const lastUserMsg = [...sessionData.messages].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
              // 最後のアシスタントメッセージを削除
              deleteLastAssistantMessage(currentSessionId);
              // 再生成（ユーザーメッセージは既に保存されているので、履歴から再構築）
              const updatedSession = getSession(currentSessionId);
              if (updatedSession) {
                const messages: ChatMessage[] = [];
                if (systemPrompt) {
                  messages.push({ role: 'system', content: systemPrompt });
                }
                for (const msg of updatedSession.messages) {
                  messages.push({ role: msg.role, content: msg.content });
                }
                
                process.stdout.write(`\n${colors.green}AI:${colors.reset} `);
                let fullContent = '';
                for await (const chunk of chatStream({ model: currentModel, messages })) {
                  if (chunk.content !== fullContent) {
                    process.stdout.write(chunk.content.slice(fullContent.length));
                    fullContent = chunk.content;
                  }
                }
                console.log('\n');
                saveMessage(currentSessionId, 'assistant', fullContent, currentModel);
              }
            }
          }
        }
        continue;
      }

      console.log(`${colors.yellow}不明なコマンド: ${input}${colors.reset}`);
      showHelp();
      continue;
    }

    // 通常のメッセージ
    await sendMessage(input);
  }
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error(`${colors.yellow}エラー:${colors.reset}`, error.message);
});

process.on('unhandledRejection', (error) => {
  console.error(`${colors.yellow}エラー:${colors.reset}`, error);
});

// 実行
main().catch(console.error);
