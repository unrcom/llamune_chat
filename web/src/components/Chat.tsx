/**
 * チャットコンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth';
import type { PsetsTemplate, Model, Session, Message, ImportedSession, PsetsCurrent } from '../types';
import * as api from '../api/client';
import { SessionEditModal } from './SessionEditModal';
import { ThinkingBlock } from './ThinkingBlock';
import { LoadingIndicator } from './LoadingIndicator';
import { SystemPromptBlock } from './SystemPromptBlock';
import { RetryModal } from './RetryModal';
import { AnswerSelector } from './AnswerSelector';
import { DirectoryTreeModal } from './DirectoryTreeModal';


export function Chat({ onNavigateToModes }: { onNavigateToModes: () => void }) {
  const { user, logout } = useAuth();
  const [psetsTemplates, setPsetsTemplates] = useState<PsetsTemplate[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [psetsName, setPsetsName] = useState<string | null>(null);
  const [psetsIcon, setPsetsIcon] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 自動スクロール制御
  const [userScrolled, setUserScrolled] = useState(false);

  // プロジェクトフォルダ関連の状態
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  // セッション編集モーダル関連の状態
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingSessionPsets, setEditingSessionPsets] = useState<PsetsCurrent | null>(null);
  const [hoverInfoSessionId, setHoverInfoSessionId] = useState<number | null>(null);

  // リトライ関連の状態
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [answerCandidates, setAnswerCandidates] = useState<Message[]>([]);
  const MAX_CANDIDATES = 8;

  // インポート（閲覧モード）関連の状態
  const [importedData, setImportedData] = useState<ImportedSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新規セッション作成直後はメッセージ再取得をスキップするフラグ
  const skipFetchMessagesRef = useRef(false);

  // セッション切り替え時は自動スクロールをスキップするフラグ
  const skipAutoScrollRef = useRef(false);

  // 新規チャット準備状態（DBに未作成）
  const [pendingNewChat, setPendingNewChat] = useState<{
    templateId: number;
    projectPath: string | null;
    systemPrompt: string | null;
    psetsName: string | null;
    psetsIcon: string | null;
    model: string | null;
  } | null>(null);

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesData, modelsData, sessionsData] = await Promise.all([
          api.getPsetsTemplates(),
          api.getModels(),
          api.getSessions(),
        ]);
        setPsetsTemplates(templatesData);
        setModels(modelsData);
        setSessions(sessionsData);
        if (templatesData.length > 0) {
          setSelectedTemplate(templatesData[0].id);
          setSelectedModel(templatesData[0].model || '');
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, []);

  // セッション選択時にメッセージを取得
  useEffect(() => {
    setRetryPending(false);
    setAnswerCandidates([]);
    setIsRetrying(false);
    setStreamingContent('');
    setStreamingThinking('');

    if (currentSession) {
      if (skipFetchMessagesRef.current) {
        skipFetchMessagesRef.current = false;
        return;
      }

      setPendingNewChat(null);

      const fetchMessages = async () => {
        try {
          skipAutoScrollRef.current = true;

          const data = await api.getSession(currentSession);
          setMessages(data.messages || []);
          setSystemPrompt(data.systemPrompt || null);
          setSessionModel(data.model || null);
          setPsetsName(data.psetsName || null);
          setPsetsIcon(data.psetsIcon || null);
        } catch (err) {
          console.error('Failed to fetch messages:', err);
          skipAutoScrollRef.current = false;
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setSystemPrompt(null);
      setSessionModel(null);
      setPsetsName(null);
      setPsetsIcon(null);
    }
  }, [currentSession]);

  // スクロールイベントハンドラ
  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setUserScrolled(!isAtBottom);
  };

  // 自動スクロール
  useEffect(() => {
    if (skipAutoScrollRef.current) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = 0;
      }
      skipAutoScrollRef.current = false;
      return;
    }
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, userScrolled]);

  // loading終了時にuserScrolledをリセット
  useEffect(() => {
    if (!loading && !isRetrying) {
      setUserScrolled(false);
    }
  }, [loading, isRetrying]);

  // 新しいチャット作成（準備状態にするだけ、DBには作成しない）
  const handleNewChat = async () => {
    if (!selectedTemplate) return;

    const template = psetsTemplates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    const modelToUse = template.model || selectedModel || null;

    setPendingNewChat({
      templateId: selectedTemplate,
      projectPath: selectedProjectPath,
      systemPrompt: template.system_prompt || null,
      psetsName: template.psets_name,
      psetsIcon: template.icon || null,
      model: modelToUse,
    });

    setCurrentSession(null);
    setMessages([]);
    setSystemPrompt(template.system_prompt || null);
    setSessionModel(template.model || selectedModel || null);
    setPsetsName(template.psets_name);
    setPsetsIcon(template.icon || null);
    setShowNewChat(false);
    setSelectedProjectPath(null);
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!currentSession && !pendingNewChat) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreamingContent('');
    setStreamingThinking('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      let sessionId = currentSession;
      if (!sessionId && pendingNewChat) {
        const data = await api.createSession(
          pendingNewChat.templateId,
          pendingNewChat.projectPath || undefined
        );
        sessionId = data.session.id;
        skipFetchMessagesRef.current = true;
        setCurrentSession(sessionId);
        setPendingNewChat(null);
      }

      if (!sessionId) {
        throw new Error('No session available');
      }

      let fullContent = '';
      let fullThinking = '';
      for await (const chunk of api.sendMessage(sessionId, userMessage, undefined, controller.signal)) {
        fullContent = chunk.content;
        fullThinking = chunk.thinking || '';
        setStreamingContent(chunk.content);
        setStreamingThinking(chunk.thinking || '');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
      }]);
      setStreamingContent('');
      setStreamingThinking('');

      const sessionsData = await api.getSessions();
      setSessions(sessionsData);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Message sending cancelled by user');
        setMessages(prev => {
          const newMessages = [...prev];
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].role === 'user') {
              newMessages.splice(i, 1);
              break;
            }
          }
          return newMessages;
        });
        setInput(userMessage);
      } else {
        console.error('Failed to send message:', err);
      }
    } finally {
      setLoading(false);
      setStreamingContent('');
      setStreamingThinking('');
      abortControllerRef.current = null;
    }
  };

  // ストリーミングをキャンセル
  const handleCancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // セッション削除
  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このセッションを削除しますか？')) return;

    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSession === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // セッションエクスポート
  const handleExportSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const { blob, filename } = await api.exportSession(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export session:', err);
      alert('エクスポートに失敗しました');
    }
  };

  // インポートボタンクリック
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // ファイル選択時のインポート処理
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ImportedSession;

      if (!data.session || !data.messages) {
        throw new Error('Invalid file format');
      }

      setImportedData(data);
      setCurrentSession(null);
    } catch (err) {
      console.error('Failed to import:', err);
      alert('インポートに失敗しました。ファイル形式を確認してください。');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 閲覧モードを終了
  const closeImportView = () => {
    setImportedData(null);
  };

  // セッション編集モーダルを開く
  const openSessionEditModal = async (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const psets = await api.getSessionPsets(session.id);
      setEditingSession(session);
      setEditingSessionPsets(psets);
    } catch (err) {
      console.error('Failed to fetch session psets:', err);
    }
  };

  // セッション編集を保存
  const handleSessionEditSave = async (title: string, psets: {
    psets_name: string;
    icon: string | null;
    description: string | null;
    model: string | null;
    system_prompt: string | null;
    max_tokens: number | null;
    context_messages: number | null;
    temperature: number | null;
    top_p: number | null;
    template_id: number | null;
    template_version: number | null;
  }) => {
    if (!editingSession) return;
    try {
      await api.updateSessionTitle(editingSession.id, title);
      await api.updateSessionPsets(editingSession.id, psets);

      // セッション一覧を更新
      const sessionsData = await api.getSessions();
      setSessions(sessionsData);

      // 現在開いているセッションなら表示も更新
      if (currentSession === editingSession.id) {
        setSystemPrompt(psets.system_prompt);
        setSessionModel(psets.model);
        setPsetsName(psets.psets_name);
        setPsetsIcon(psets.icon);
      }

      setEditingSession(null);
      setEditingSessionPsets(null);
    } catch (err) {
      console.error('Failed to save session edit:', err);
    }
  };

  // 日付フォーマット（YYYY-MM-DD）
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // リトライ実行
  const handleRetry = async (model: string) => {
    if (!currentSession || isRetrying) return;

    if (answerCandidates.length === 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant) return;
      setAnswerCandidates([lastAssistant]);
    }

    setIsRetrying(true);
    setStreamingContent('');
    setStreamingThinking('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let fullContent = '';
      let fullThinking = '';
      let retryModel = model;

      for await (const chunk of api.retryMessage(currentSession, model, controller.signal)) {
        fullContent = chunk.content;
        fullThinking = chunk.thinking || '';
        retryModel = chunk.model;
        setStreamingContent(chunk.content);
        setStreamingThinking(chunk.thinking || '');
      }

      const newAnswer: Message = {
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        model: retryModel,
      };
      setStreamingContent('');
      setStreamingThinking('');
      setAnswerCandidates(prev => [...prev, newAnswer]);
      setRetryPending(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Retry cancelled by user');
      } else {
        console.error('Failed to retry:', err);
      }
      if (answerCandidates.length <= 1) {
        setAnswerCandidates([]);
        setRetryPending(false);
      }
    } finally {
      setIsRetrying(false);
      setStreamingContent('');
      setStreamingThinking('');
      abortControllerRef.current = null;
    }
  };

  // 追加リトライ用（モーダルを表示）
  const handleRetryMore = () => {
    setShowRetryModal(true);
  };

  // 回答選択を確定
  const handleConfirmSelection = async (
    adoptedIndex: number,
    keepIndices: number[],
    discardIndices: number[]
  ) => {
    if (!currentSession || answerCandidates.length === 0) return;

    const adoptedAnswer = answerCandidates[adoptedIndex];
    const keptAnswers = keepIndices.map(i => answerCandidates[i]);

    try {
      await api.selectRetry(currentSession, adoptedIndex, keepIndices, discardIndices);

      setMessages(prev => {
        const newMessages = [...prev];
        let lastAssistantIdx = -1;
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'assistant') {
            lastAssistantIdx = i;
            break;
          }
        }

        if (lastAssistantIdx !== -1) {
          newMessages[lastAssistantIdx] = { ...adoptedAnswer, is_adopted: true };
          const keptMessages = keptAnswers.map(answer => ({
            ...answer,
            is_adopted: false,
          }));
          newMessages.splice(lastAssistantIdx + 1, 0, ...keptMessages);
        }

        return newMessages;
      });

      setRetryPending(false);
      setAnswerCandidates([]);
    } catch (err) {
      console.error('Failed to confirm selection:', err);
    }
  };

  // 最後のアシスタントメッセージのインデックスを取得
  const lastAssistantIndex = messages.reduceRight(
    (acc, msg, idx) => (acc === -1 && msg.role === 'assistant' ? idx : acc),
    -1
  );


  // 共通スタイル
  const inputCls = "w-full px-3 py-2 bg-[#0f0f23] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#4a9eff]";

  return (
    <div className="flex h-screen bg-[#1a1a2e] text-white">

      {/* サイドバー */}
      <aside className={`bg-[#16213e] flex flex-col border-r border-[#333] transition-all duration-300 z-10 relative ${isSidebarOpen ? 'w-[280px]' : 'w-0 -translate-x-[280px] overflow-hidden'}`}>
        <div className="p-4 border-b border-[#333]">
          <div className="flex items-center gap-2 mb-4">
            <button
              className="bg-transparent border-none text-[#888] text-xl cursor-pointer px-2 py-1 rounded hover:bg-[#333] hover:text-white transition-colors"
              onClick={() => setIsSidebarOpen(false)}
            >
              ☰
            </button>
            <h2 className="m-0 text-lg text-[#4a9eff] font-semibold flex-1">llamune_chat</h2>
          </div>
          <button className="w-full py-3 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer text-sm hover:bg-[#3a8eef] transition-colors" onClick={() => setShowNewChat(true)}>
            + 新しいチャット
          </button>
          <button className="w-full py-3 mt-2 bg-transparent text-[#888] border border-[#444] rounded-md cursor-pointer text-sm hover:bg-[#333] hover:text-[#4a9eff] hover:border-[#4a9eff] transition-colors" onClick={onNavigateToModes}>
            ⚙️ パラメータセット管理
          </button>
          <button className="w-full py-3 mt-2 bg-transparent text-[#888] border border-[#444] rounded-md cursor-pointer text-sm hover:bg-[#333] hover:text-white hover:border-[#666] transition-colors" onClick={handleImportClick}>
            📥 インポート
          </button>
        </div>

        {/* セッション一覧 */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`group flex justify-between items-center px-3 py-3 rounded-md cursor-pointer mb-1 relative transition-colors hover:bg-[#1a1a2e] ${currentSession === session.id ? 'bg-[#4a9eff33]' : ''}`}
              onClick={() => setCurrentSession(session.id)}
            >
              <div className="flex items-center flex-1 min-w-0">
                <button
                  className="bg-none border-none p-0 cursor-pointer text-base leading-none mr-2 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setHoverInfoSessionId(hoverInfoSessionId === session.id ? null : session.id); }}
                >
                  {session.psets_icon || '🔵'}
                </button>
                {hoverInfoSessionId === session.id && (
                  <div className="absolute left-0 top-full mt-2 bg-[#1a1a2e] border border-[#444] rounded-md p-3 w-[280px] z-[1000] shadow-lg">
                    {[
                      { label: '📅 日付:', value: session.created_at ? formatDate(session.created_at) : '(不明)' },
                      { label: '🎯 パラメータセット:', value: `${session.psets_icon || ''} ${session.psets_name || '(なし)'}` },
                      { label: '🤖 LLM:', value: session.model || '(不明)' },
                      { label: '📁 プロジェクト:', value: session.project_path || '(なし)', mono: true },
                      { label: '💬 チャット数:', value: String(session.message_count ?? 0) },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="flex gap-2 text-xs mb-1 text-[#ccc] items-start">
                        <span className="text-[#888] whitespace-nowrap shrink-0">{label}</span>
                        <span className={`break-all ${mono ? 'font-mono text-[0.7rem]' : ''}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {currentSession === session.id && '⭐ '}
                  {session.title || '(無題)'}
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity session-actions-hover">
                <button className="bg-none border-none cursor-pointer p-1 text-sm opacity-70 hover:opacity-100 transition-opacity" onClick={(e) => handleExportSession(session.id, e)} title="エクスポート">📥</button>
                <button className="bg-none border-none cursor-pointer p-1 text-sm opacity-70 hover:opacity-100 transition-opacity" onClick={(e) => openSessionEditModal(session, e)} title="編集">✏️</button>
                <button className="bg-none border-none cursor-pointer p-1 text-sm opacity-70 hover:opacity-100 hover:text-[#ff4444] transition-colors" onClick={(e) => handleDeleteSession(session.id, e)} title="削除">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#333]">
          <div className="flex justify-between items-center text-sm text-[#888]">
            <span>👤 {user?.username}</span>
            <button onClick={logout} className="bg-none border-none text-[#4a9eff] cursor-pointer text-sm hover:underline">ログアウト</button>
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        {!isSidebarOpen && (
          <button
            className="fixed top-4 left-4 z-[100] bg-[#16213e] border border-[#333] text-[#888] text-xl cursor-pointer px-3 py-2 rounded-md hover:bg-[#1a1a2e] hover:text-[#4a9eff] hover:border-[#4a9eff] transition-colors shadow-md"
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
        )}

        {/* インポート閲覧モード */}
        {importedData && (
          <>
            <div className="flex justify-between items-center px-4 py-3 bg-[#2a3a5e] border-b border-[#4a9eff]">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="bg-[#4a9eff] text-white px-3 py-1 rounded text-sm font-medium">📖 閲覧モード</span>
                <span className="text-white font-medium">{importedData.session.title || '(無題)'}</span>
                <span className="text-[#888] text-sm">
                  {importedData.messages.length} メッセージ
                  {importedData.session.created_at && ` • ${formatDate(importedData.session.created_at)}`}
                </span>
              </div>
              <button className="bg-transparent border border-[#666] text-[#888] px-4 py-2 rounded-md text-sm hover:bg-[#dc3545] hover:border-[#dc3545] hover:text-white transition-colors" onClick={closeImportView}>
                閲覧を終了
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              {importedData.messages.map((msg, i) => (
                <div key={i} className={`mb-4 max-w-[80%] overflow-hidden ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                  <div className="text-xs text-[#888] mb-1">{msg.role === 'user' ? '👤 You' : '🤖 AI'}</div>
                  <div className={`p-4 rounded-xl break-words leading-relaxed ${msg.role === 'user' ? 'bg-[#4a9eff33]' : 'bg-[#16213e]'}`}>
                    <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 通常チャットモード */}
        {!importedData && (currentSession || pendingNewChat) && (
          <>
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              {systemPrompt && (
                <SystemPromptBlock
                  systemPrompt={systemPrompt}
                  psetsIcon={psetsIcon ?? undefined}
                  psetsName={psetsName ?? undefined}
                  model={sessionModel ?? undefined}
                />
              )}
              {messages.map((msg, i) => {
                const isKeptOnly = msg.is_adopted === false;
                if (retryPending && i === lastAssistantIndex && msg.role === 'assistant') {
                  return null;
                }
                const isLastAssistant = i === lastAssistantIndex && msg.role === 'assistant';
                return (
                  <div key={i} className={`mb-4 max-w-[80%] overflow-hidden ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} ${isKeptOnly ? 'opacity-70' : ''}`}>
                    <div className="text-xs text-[#888] mb-1 flex items-center gap-2">
                      {msg.role === 'user'
                        ? '👤 You'
                        : <><span>🤖 AI{msg.model && <span className="text-xs text-[#6c757d] font-normal ml-1">{msg.model}</span>}</span></>
                      }
                      {isKeptOnly && <span className="ml-2 text-xs bg-yellow-400 text-black px-1.5 py-0.5 rounded font-medium">📋 履歴のみ</span>}
                    </div>
                    <div className={`p-4 rounded-xl break-words leading-relaxed ${msg.role === 'user' ? 'bg-[#4a9eff33]' : `bg-[#16213e] ${isKeptOnly ? 'border border-dashed border-[#555]' : ''}`}`}>
                      {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                    </div>
                    {isLastAssistant && !loading && !isRetrying && !retryPending && (
                      <button
                        className="mt-2 px-3 py-1 bg-transparent border border-[#444] rounded text-[#888] text-xs cursor-pointer hover:bg-[#333] hover:text-white hover:border-[#555] transition-colors"
                        onClick={() => setShowRetryModal(true)}
                      >
                        🔄 別モデルで再試行
                      </button>
                    )}
                  </div>
                );
              })}

              {retryPending && answerCandidates.length > 0 && (
                <AnswerSelector
                  candidates={answerCandidates}
                  onConfirm={handleConfirmSelection}
                  onRetryMore={handleRetryMore}
                  isRetrying={loading}
                />
              )}

              {/* ストリーミング中（通常送信） */}
              {loading && !isRetrying && (
                <div className="mb-4 max-w-[80%] mr-auto">
                  <div className="text-xs text-[#888] mb-1">🤖 AI</div>
                  <div className="p-4 rounded-xl bg-[#16213e] break-words leading-relaxed">
                    {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                    {streamingContent ? (
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown></div>
                    ) : (
                      <LoadingIndicator message={streamingThinking ? '回答を作成中...' : '思考中...'} />
                    )}
                  </div>
                </div>
              )}

              {/* リトライ中のストリーミング */}
              {isRetrying && (
                <div className="mb-4 max-w-[80%] mr-auto">
                  <div className="text-xs text-[#888] mb-1">🤖 AI (リトライ中)</div>
                  <div className="p-4 rounded-xl bg-[#1a2a1a] border border-[#2a4a2a] break-words leading-relaxed">
                    {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                    {streamingContent ? (
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown></div>
                    ) : (
                      <LoadingIndicator message={streamingThinking ? '回答を作成中...' : '別のモデルで思考中...'} />
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 p-4 border-t border-[#333]">
              <textarea
                className="flex-1 px-3 py-3 border border-[#333] rounded-md bg-[#0f0f23] text-white text-base resize-none min-h-[60px] max-h-[200px] font-inherit focus:outline-none focus:border-[#4a9eff]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="メッセージを入力..."
                disabled={loading || isRetrying || retryPending}
              />
              {loading || isRetrying ? (
                <button className="px-6 py-3 bg-[#dc3545] text-white border-none rounded-md cursor-pointer text-base self-end hover:bg-[#c82333] transition-colors" onClick={handleCancelStreaming}>
                  停止
                </button>
              ) : (
                <button className="px-6 py-3 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer text-base self-end hover:bg-[#3a8eef] disabled:bg-[#555] disabled:cursor-not-allowed transition-colors" onClick={handleSend} disabled={retryPending || !input.trim()}>
                  送信
                </button>
              )}
            </div>
          </>
        )}

        {/* セッション未選択 */}
        {!importedData && !currentSession && !pendingNewChat && (
          <div className="flex flex-col justify-center items-center h-full text-[#888]">
            <h2 className="text-4xl mb-2 text-white">🔵 llamune_chat</h2>
            <p className="mb-6">新しいチャットを開始するか、左のセッションを選択してください</p>
            <button className="px-6 py-3 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer text-base hover:bg-[#3a8eef] transition-colors" onClick={() => setShowNewChat(true)}>
              + 新しいチャット
            </button>
          </div>
        )}
      </main>

      {/* 新規チャットモーダル */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={() => setShowNewChat(false)}>
          <div className="bg-[#16213e] p-6 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">新しいチャット</h3>
            <div className="mb-4">
              <label className="block text-[#ccc] text-sm mb-2">パラメータセット</label>
              <select className={inputCls} value={selectedTemplate ?? ''} onChange={(e) => setSelectedTemplate(e.target.value ? Number(e.target.value) : null)}>
                <option value="">なし（カスタム設定）</option>
                {psetsTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.psets_name}</option>
                ))}
              </select>
            </div>
            {!selectedTemplate && (
              <div className="mb-4">
                <label className="block text-[#ccc] text-sm mb-2">モデル</label>
                <select className={inputCls} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  <option value="">モデルを選択...</option>
                  {models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-[#ccc] text-sm mb-2">プロジェクトフォルダ（任意）</label>
              <div className="flex gap-2 items-center">
                <input type="text" readOnly value={selectedProjectPath ?? ''} placeholder="フォルダを選択..." className={`${inputCls} flex-1`} />
                <button className="px-3 py-2 bg-[#333] border border-[#444] text-white rounded-md text-sm hover:bg-[#444] transition-colors whitespace-nowrap" onClick={() => setShowDirectoryModal(true)}>
                  参照
                </button>
                {selectedProjectPath && (
                  <button className="px-3 py-2 bg-[#333] border border-[#444] text-[#888] rounded-md text-sm hover:bg-[#444] hover:text-white transition-colors" onClick={() => setSelectedProjectPath('')}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors" onClick={() => setShowNewChat(false)}>キャンセル</button>
              <button
                className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] disabled:bg-[#555] disabled:cursor-not-allowed transition-colors"
                onClick={handleNewChat}
                disabled={!psetsTemplates.find(t => t.id === selectedTemplate)?.model && !selectedModel}
              >
                開始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* リトライモーダル */}
      <RetryModal
        isOpen={showRetryModal}
        onClose={() => setShowRetryModal(false)}
        models={models}
        currentModel={sessionModel || ''}
        onRetry={handleRetry}
      />

      {/* ディレクトリ選択モーダル */}
      <DirectoryTreeModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        onSelect={(path) => { setSelectedProjectPath(path); setShowDirectoryModal(false); }}
      />

      {/* セッション編集モーダル */}
      {editingSession && (
        <SessionEditModal
          session={editingSession}
          currentPsets={editingSessionPsets}
          onClose={() => { setEditingSession(null); setEditingSessionPsets(null); }}
          onSave={handleSessionEditSave}
        />
      )}
    </div>
  );
}
