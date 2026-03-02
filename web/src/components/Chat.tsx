/**
 * チャットコンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth';
import type { PsetsTemplate, Model, Session, Message, ImportedSession, PsetsCurrent, Folder } from '../types';
import * as api from '../api/client';
import { SessionEditModal } from './SessionEditModal';
import { ThinkingBlock } from './ThinkingBlock';
import { LoadingIndicator } from './LoadingIndicator';
import { SystemPromptBlock } from './SystemPromptBlock';
import { RetryModal } from './RetryModal';
import { AnswerSelector } from './AnswerSelector';
import { DirectoryTreeModal } from './DirectoryTreeModal';


// ========================================
// セッションアイテムコンポーネント
// ========================================
function SessionItem({
  session, folders, isActive, hoverInfoSessionId, menuOpenSessionId, isTrash = false,
  onSelect, onHoverInfo, onMenuOpen, onExport, onEdit, onDelete, onMoveSelect, formatDate,
}: {
  session: Session;
  folders: Folder[];
  isActive: boolean;
  hoverInfoSessionId: number | null;
  menuOpenSessionId: number | null;
  isTrash?: boolean;
  onSelect: () => void;
  onHoverInfo: (id: number) => void;
  onMenuOpen: (id: number | null) => void;
  onExport: (id: number, e: React.MouseEvent) => void;
  onEdit: (session: Session, e: React.MouseEvent) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onMoveSelect: (sessionId: number, folderId: number | null) => void;
  formatDate: (d: string) => string;
}) {
  const isMenuOpen = menuOpenSessionId === session.id;

  return (
    <div
      className={`group flex items-start px-3 py-2.5 rounded-md cursor-pointer mb-1 relative transition-colors hover:bg-[#1a1a2e] ${isActive ? 'bg-[#4a9eff33]' : ''}`}
      onClick={onSelect}
    >
      {/* アイコン（情報ポップオーバートリガー） */}
      <button
        className="bg-none border-none p-0 cursor-pointer text-base leading-none mr-2 shrink-0 mt-0.5"
        onClick={(e) => { e.stopPropagation(); onHoverInfo(session.id); }}
      >
        {session.psets_icon || '🔵'}
      </button>

      {/* セッション情報ポップオーバー */}
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

      {/* セッション名（2行折り返し） */}
      <span className="flex-1 text-sm leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {isActive && '⭐ '}
        {session.title || '(無題)'}
      </span>

      {/* ミートボールメニューボタン */}
      <div className="shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button
          className="p-1 text-[#888] hover:text-white text-base leading-none rounded hover:bg-[#333]"
          onClick={() => onMenuOpen(isMenuOpen ? null : session.id)}
          title="メニュー"
        >⋯</button>
      </div>

      {/* ドロップダウンメニュー */}
      {isMenuOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-[#444] rounded-md py-1 w-44 z-[1000] shadow-lg"
          onClick={e => e.stopPropagation()}
        >
          {isTrash ? (
            <>
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#ccc] hover:bg-[#333]"
                onClick={(e) => { onMoveSelect(session.id, null); onMenuOpen(null); }}
              >↩️ 元に戻す</button>
              <div className="border-t border-[#333] my-1" />
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#ff4444] hover:bg-[#333]"
                onClick={(e) => { onDelete(session.id, e); onMenuOpen(null); }}
              >🗑️ 完全に削除</button>
            </>
          ) : (
            <>
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#ccc] hover:bg-[#333]"
                onClick={(e) => { onExport(session.id, e); onMenuOpen(null); }}
              >📥 エクスポート</button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#ccc] hover:bg-[#333]"
                onClick={(e) => { onEdit(session, e); onMenuOpen(null); }}
              >✏️ 編集</button>
              <div className="border-t border-[#333] my-1" />
              <div className="px-3 py-1 text-xs text-[#888]">フォルダに移動</div>
              <button
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] ${!session.folder_id ? 'text-[#4a9eff]' : 'text-[#ccc]'}`}
                onClick={() => { onMoveSelect(session.id, null); onMenuOpen(null); }}
              >🚫 フォルダなし {!session.folder_id && '✓'}</button>
              {folders.map(f => (
                <button
                  key={f.id}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] ${session.folder_id === f.id ? 'text-[#4a9eff]' : 'text-[#ccc]'}`}
                  onClick={() => { onMoveSelect(session.id, f.id); onMenuOpen(null); }}
                >
                  {f.icon || '📁'} {f.name} {session.folder_id === f.id && '✓'}
                </button>
              ))}
              <div className="border-t border-[#333] my-1" />
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#ff4444] hover:bg-[#333]"
                onClick={(e) => { onDelete(session.id, e); onMenuOpen(null); }}
              >🗑️ ゴミ箱へ</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Chat({ onNavigateToModes }: { onNavigateToModes: () => void }) {
  const { user, logout } = useAuth();
  const [psetsTemplates, setPsetsTemplates] = useState<PsetsTemplate[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [trashFolder, setTrashFolder] = useState<Folder | null>(null);
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

  // フォルダ管理関連の状態
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderFormName, setFolderFormName] = useState('');
  const [folderFormIcon, setFolderFormIcon] = useState('📁');
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<number | null>(null);

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
        const [templatesData, modelsData, sessionsData, foldersData, trashData] = await Promise.all([
          api.getPsetsTemplates(),
          api.getModels(),
          api.getSessions(),
          api.getFolders(),
          api.getTrashFolder(),
        ]);
        setPsetsTemplates(templatesData);
        setModels(modelsData);
        setSessions(sessionsData);
        setFolders(foldersData);
        setTrashFolder(trashData);

        // 全フォルダを閉じた状態に初期化（currentSessionが含まれるフォルダは開く）
        const currentSessionData = sessionsData.find((s: { id: number }) => s.id === currentSession);
        const openFolderId = currentSessionData?.folder_id;
        const allFolderIds = new Set<number>(
          [...foldersData, ...(trashData ? [trashData] : [])].map((f: { id: number }) => f.id).filter((id: number) => id !== openFolderId)
        );
        setCollapsedFolders(allFolderIds);
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

          // 未決定のリトライ候補を復元
          if (data.pendingRetry && data.pendingRetry.candidates.length > 1) {
            const candidates = data.pendingRetry.candidates.map((c: { content: string; thinking?: string; model?: string }) => ({
              role: 'assistant' as const,
              content: c.content,
              thinking: c.thinking,
              model: c.model,
            }));
            setAnswerCandidates(candidates);
            setRetryPending(true);
            // messagesからリトライ候補（最後のユーザーメッセージ以降のassistant）を除外
            setMessages(prev => {
              const lastUserIdx = [...prev].map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1).pop();
              if (lastUserIdx === undefined) return prev;
              return prev.slice(0, lastUserIdx + 1);
            });
          }
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

  // フォルダの折りたたみ切り替え
  const toggleFolderCollapse = (folderId: number) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) { next.delete(folderId); } else { next.add(folderId); }
      return next;
    });
  };

  // フォルダ作成・編集モーダルを開く
  const openFolderModal = (folder?: Folder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderFormName(folder.name);
      setFolderFormIcon(folder.icon || '📁');
    } else {
      setEditingFolder(null);
      setFolderFormName('');
      setFolderFormIcon('📁');
    }
    setShowFolderModal(true);
  };

  // フォルダ保存
  const handleFolderSave = async () => {
    if (!folderFormName.trim()) return;
    try {
      if (editingFolder) {
        await api.updateFolder(editingFolder.id, { name: folderFormName.trim(), icon: folderFormIcon || null });
      } else {
        await api.createFolder({ name: folderFormName.trim(), icon: folderFormIcon || null });
      }
      setFolders(await api.getFolders());
      setShowFolderModal(false);
    } catch (err) {
      console.error('Failed to save folder:', err);
    }
  };

  // フォルダ削除
  const handleFolderDelete = async (folder: Folder) => {
    if (!confirm(`「${folder.name}」を削除しますか？\n中のセッションはフォルダなしになります。`)) return;
    try {
      await api.deleteFolder(folder.id);
      setFolders(await api.getFolders());
      setSessions(await api.getSessions());
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  // セッションをフォルダに移動
  const handleMoveSession = async (sessionId: number, folderId: number | null) => {
    try {
      await api.updateSessionFolder(folderId, sessionId);
      setSessions(await api.getSessions());
      setMenuOpenSessionId(null);
    } catch (err) {
      console.error('Failed to move session:', err);
    }
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
      let fullModel = '';
      for await (const chunk of api.sendMessage(sessionId, userMessage, undefined, controller.signal)) {
        fullContent = chunk.content;
        fullThinking = chunk.thinking || '';
        if (chunk.model) fullModel = chunk.model;
        setStreamingContent(chunk.content);
        setStreamingThinking(chunk.thinking || '');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        model: fullModel || undefined,
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

  // セッション削除（ゴミ箱へ移動）
  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trashFolder) return;
    try {
      await api.updateSessionFolder(trashFolder.id, id);
      setSessions(await api.getSessions());
      if (currentSession === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to move session to trash:', err);
    }
  };

  // ゴミ箱からの物理削除
  const handleHardDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このセッションを完全に削除しますか？\nこの操作は取り消せません。')) return;
    try {
      await api.hardDeleteSession(id);
      setSessions(await api.getSessions());
      if (currentSession === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to hard delete session:', err);
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

        const adoptedMessage = { ...adoptedAnswer, is_adopted: true };
        const keptMessages = keptAnswers.map(answer => ({ ...answer, is_adopted: false }));

        if (lastAssistantIdx !== -1) {
          // 既存のassistantメッセージを採用で置き換え、履歴保存を後ろに挿入
          newMessages[lastAssistantIdx] = adoptedMessage;
          newMessages.splice(lastAssistantIdx + 1, 0, ...keptMessages);
        } else {
          // retryPending復元後など、assistantメッセージが除外済みの場合は末尾に追加
          newMessages.push(adoptedMessage, ...keptMessages);
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
          {psetsTemplates.filter(t => t.model).length > 0 ? (
            <button className="w-full py-3 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer text-sm hover:bg-[#3a8eef] transition-colors" onClick={() => setShowNewChat(true)}>
              + 新しいチャット
            </button>
          ) : (
            <p className="text-xs text-[#ff6b6b] font-bold text-center py-2">⚠️ パラメータセット管理でモデルを設定してください</p>
          )}
          <button className="w-full py-3 mt-2 bg-transparent text-[#888] border border-[#444] rounded-md cursor-pointer text-sm hover:bg-[#333] hover:text-[#4a9eff] hover:border-[#4a9eff] transition-colors" onClick={onNavigateToModes}>
            ⚙️ パラメータセット管理
          </button>
          <button className="w-full py-3 mt-2 bg-transparent text-[#888] border border-[#444] rounded-md cursor-pointer text-sm hover:bg-[#333] hover:text-white hover:border-[#666] transition-colors" onClick={handleImportClick}>
            📥 インポート
          </button>
        </div>

        {/* セッション一覧（フォルダ構造） */}
        <div className="flex-1 overflow-y-auto p-2">

          {/* フォルダ追加ボタン */}
          <button
            className="w-full py-2 mb-2 bg-transparent text-[#888] border border-dashed border-[#444] rounded-md cursor-pointer text-xs hover:bg-[#333] hover:text-[#4a9eff] hover:border-[#4a9eff] transition-colors"
            onClick={() => openFolderModal()}
          >
            + フォルダを追加
          </button>

          {/* フォルダ一覧 */}
          {folders.map(folder => {
            const folderSessions = sessions.filter(s => s.folder_id === folder.id);
            const isCollapsed = collapsedFolders.has(folder.id);
            return (
              <div key={folder.id} className="mb-2">
                {/* フォルダヘッダー */}
                <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-[#1a1a2e] cursor-pointer"
                  onClick={() => toggleFolderCollapse(folder.id)}
                >
                  <span className="text-[#888] text-xs">{isCollapsed ? '▶' : '▼'}</span>
                  <span className="text-sm mr-1">{folder.icon || '📁'}</span>
                  <span className="flex-1 text-sm text-[#ccc] font-medium truncate">{folder.name}</span>
                  <span className="text-xs text-[#666]">{folderSessions.length}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <button className="p-1 text-xs text-[#888] hover:text-white" onClick={() => openFolderModal(folder)} title="編集">✏️</button>
                    <button className="p-1 text-xs text-[#888] hover:text-[#ff4444]" onClick={() => handleFolderDelete(folder)} title="削除">🗑️</button>
                  </div>
                </div>

                {/* フォルダ内セッション */}
                {!isCollapsed && (
                  <div className="ml-3 border-l border-[#333] pl-2">
                    {folderSessions.length === 0 && (
                      <div className="text-xs text-[#555] py-1 px-2">セッションなし</div>
                    )}
                    {folderSessions.map(session => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        folders={folders}
                        isActive={currentSession === session.id}
                        hoverInfoSessionId={hoverInfoSessionId}
                        menuOpenSessionId={menuOpenSessionId}
                        onSelect={() => setCurrentSession(session.id)}
                        onHoverInfo={(id) => setHoverInfoSessionId(hoverInfoSessionId === id ? null : id)}
                        onMenuOpen={setMenuOpenSessionId}
                        onExport={handleExportSession}
                        onEdit={openSessionEditModal}
                        onDelete={handleDeleteSession}
                        onMoveSelect={handleMoveSession}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* フォルダなしセッション */}
          {(() => {
            const noFolderSessions = sessions.filter(s => !s.folder_id);
            if (noFolderSessions.length === 0) return null;
            return (
              <div className="mt-2">
                {folders.length > 0 && (
                  <div className="text-xs text-[#555] px-2 py-1 mb-1">── フォルダなし ──</div>
                )}
                {noFolderSessions.map(session => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    folders={folders}
                    isActive={currentSession === session.id}
                    hoverInfoSessionId={hoverInfoSessionId}
                    menuOpenSessionId={menuOpenSessionId}
                    onSelect={() => setCurrentSession(session.id)}
                    onHoverInfo={(id) => setHoverInfoSessionId(hoverInfoSessionId === id ? null : id)}
                    onMenuOpen={setMenuOpenSessionId}
                    onExport={handleExportSession}
                    onEdit={openSessionEditModal}
                    onDelete={handleDeleteSession}
                    onMoveSelect={handleMoveSession}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            );
          })()}

          {/* ゴミ箱フォルダ */}
          {trashFolder && (() => {
            const trashSessions = sessions.filter(s => s.folder_id === trashFolder.id);
            const isCollapsed = collapsedFolders.has(trashFolder.id);
            return (
              <div className="mt-3 border-t border-[#333] pt-2">
                <div
                  className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-[#1a1a2e] cursor-pointer"
                  onClick={() => toggleFolderCollapse(trashFolder.id)}
                >
                  <span className="text-[#888] text-xs">{isCollapsed ? '▶' : '▼'}</span>
                  <span className="text-sm mr-1">🗑️</span>
                  <span className="flex-1 text-sm text-[#666] truncate">ゴミ箱</span>
                  <span className="text-xs text-[#555]">{trashSessions.length}</span>
                </div>
                {!isCollapsed && (
                  <div className="ml-3 border-l border-[#333] pl-2">
                    {trashSessions.length === 0 && (
                      <div className="text-xs text-[#555] py-1 px-2">空のゴミ箱</div>
                    )}
                    {trashSessions.map(session => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        folders={folders}
                        isActive={currentSession === session.id}
                        hoverInfoSessionId={hoverInfoSessionId}
                        menuOpenSessionId={menuOpenSessionId}
                        isTrash={true}
                        onSelect={() => setCurrentSession(session.id)}
                        onHoverInfo={(id) => setHoverInfoSessionId(hoverInfoSessionId === id ? null : id)}
                        onMenuOpen={setMenuOpenSessionId}
                        onExport={handleExportSession}
                        onEdit={openSessionEditModal}
                        onDelete={handleHardDeleteSession}
                        onMoveSelect={handleMoveSession}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey && !loading && !isRetrying && !retryPending && input.trim()) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="メッセージを入力... (Ctrl+Enter で送信)"
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
            {psetsTemplates.filter(t => t.model).length > 0 ? (
            <button className="px-6 py-3 bg-[#4a9eff] text-white border-none rounded-md cursor-pointer text-base hover:bg-[#3a8eef] transition-colors" onClick={() => setShowNewChat(true)}>
              + 新しいチャット
            </button>
          ) : (
            <p className="text-sm text-[#ff6b6b] font-bold text-center py-2">⚠️ パラメータセット管理でモデルを設定してください</p>
          )}
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
                {psetsTemplates.filter(t => t.model).map(t => (
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

      {/* フォルダ作成・編集モーダル */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={() => setShowFolderModal(false)}>
          <div className="bg-[#16213e] p-6 rounded-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{editingFolder ? 'フォルダを編集' : '新しいフォルダ'}</h3>
            <div className="mb-4">
              <label className="block text-[#ccc] text-sm mb-2">アイコン</label>
              <select
                className="w-full px-3 py-2 bg-[#0f0f23] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#4a9eff]"
                value={folderFormIcon}
                onChange={e => setFolderFormIcon(e.target.value)}
              >
                {[
                  { value: '📁', label: '📁 フォルダ' },
                  { value: '📂', label: '📂 フォルダ（開）' },
                  { value: '💻', label: '💻 コーディング' },
                  { value: '🤖', label: '🤖 AI・ロボット' },
                  { value: '✍️', label: '✍️ ライティング' },
                  { value: '🎨', label: '🎨 クリエイティブ' },
                  { value: '📊', label: '📊 分析・データ' },
                  { value: '🔬', label: '🔬 研究・学術' },
                  { value: '💼', label: '💼 ビジネス' },
                  { value: '🎓', label: '🎓 教育・学習' },
                  { value: '🌍', label: '🌍 翻訳・言語' },
                  { value: '🎮', label: '🎮 ゲーム' },
                  { value: '📚', label: '📚 読書・文学' },
                  { value: '🎵', label: '🎵 音楽' },
                  { value: '🛠️', label: '🛠️ エンジニアリング' },
                  { value: '💡', label: '💡 アイデア・創造' },
                  { value: '📱', label: '📱 テクノロジー' },
                  { value: '🎯', label: '🎯 目標・計画' },
                  { value: '⭐', label: '⭐ お気に入り' },
                  { value: '🌟', label: '🌟 その他' },
                ].map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-[#ccc] text-sm mb-2">フォルダ名</label>
              <input
                className="w-full px-3 py-2 bg-[#0f0f23] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#4a9eff]"
                value={folderFormName}
                onChange={e => setFolderFormName(e.target.value)}
                placeholder="フォルダ名を入力..."
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 bg-[#333] text-white rounded-md text-sm hover:bg-[#444] transition-colors" onClick={() => setShowFolderModal(false)}>キャンセル</button>
              <button
                className="px-4 py-2 bg-[#4a9eff] text-white rounded-md text-sm hover:bg-[#3a8eef] disabled:bg-[#555] disabled:cursor-not-allowed transition-colors"
                onClick={handleFolderSave}
                disabled={!folderFormName.trim()}
              >
                {editingFolder ? '保存' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* hidden file input */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileImport} />
    </div>
  );
}
