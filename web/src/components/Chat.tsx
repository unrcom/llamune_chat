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
import './Chat.css';

/**
 * Thinking 折りたたみコンポーネント
 */
function ThinkingBlock({ thinking }: { thinking: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="thinking-block">
      <button
        className="thinking-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="thinking-icon">{isOpen ? '▼' : '▶'}</span>
        <span>思考過程</span>
      </button>
      {isOpen && (
        <div className="thinking-content">
          {thinking}
        </div>
      )}
    </div>
  );
}

/**
 * ローディングインジケーター（スピナー）コンポーネント
 */
function LoadingIndicator({ message = '回答を生成中...' }: { message?: string }) {
  return (
    <div className="loading-indicator">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}

/**
 * システムプロンプト折りたたみコンポーネント
 */
function SystemPromptBlock({
  systemPrompt,
  psetsIcon,
  psetsName,
  model,
}: {
  systemPrompt: string;
  psetsIcon?: string;
  psetsName?: string;
  model?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const headerParts: string[] = [];
  if (psetsIcon) headerParts.push(psetsIcon);
  if (psetsName) headerParts.push(psetsName);
  if (model) headerParts.push(`(${model})`);

  return (
    <div className="system-prompt-block">
      <button
        className="system-prompt-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="thinking-icon">{isOpen ? '▼' : '▶'}</span>
        <span>
          システムプロンプト
          {headerParts.length > 0 && ` — ${headerParts.join(' ')}`}
        </span>
      </button>
      {isOpen && (
        <div className="system-prompt-content">
          <pre>{systemPrompt}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * リトライモーダルコンポーネント
 */
function RetryModal({
  isOpen,
  onClose,
  models,
  currentModel,
  onRetry,
}: {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  currentModel: string;
  onRetry: (model: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal retry-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔄 別のモデルで再試行</h3>
        <p>使用するモデルを選択してください</p>
        <div className="model-list">
          {models.map((model) => (
            <button
              key={model.name}
              className={`model-item ${model.name === currentModel ? 'current' : ''}`}
              onClick={() => {
                onRetry(model.name);
                onClose();
              }}
            >
              <span className="model-name">{model.name}</span>
              <span className="model-size">{model.sizeFormatted}</span>
              {model.name === currentModel && <span className="current-badge">現在</span>}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 回答選択コンポーネント（リトライ比較）
 */
function AnswerSelector({
  candidates,
  onConfirm,
  onRetryMore,
  isRetrying,
  maxCandidates,
}: {
  candidates: Message[];
  onConfirm: (adoptedIndex: number, keepIndices: number[], discardIndices: number[]) => void;
  onRetryMore: () => void;
  isRetrying: boolean;
  maxCandidates: number;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [keepIndices, setKeepIndices] = useState<number[]>([]);

  const toggleKeep = (index: number) => {
    if (index === selectedIndex) return;
    setKeepIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleConfirm = () => {
    const allIndices = candidates.map((_, i) => i);
    const discardIndices = allIndices.filter(
      (i) => i !== selectedIndex && !keepIndices.includes(i)
    );
    onConfirm(selectedIndex, keepIndices, discardIndices);
  };

  return (
    <div className="answer-selector">
      <div className="answer-selector-header">
        <span>🔄 回答を比較中 ({candidates.length}/{maxCandidates})</span>
        {!isRetrying && candidates.length < maxCandidates && (
          <button className="retry-more-btn" onClick={onRetryMore}>
            + さらにリトライ
          </button>
        )}
      </div>
      <div className="answer-tabs">
        {candidates.map((candidate, i) => (
          <div
            key={i}
            className={`answer-tab ${i === selectedIndex ? 'selected' : ''} ${
              keepIndices.includes(i) ? 'kept' : ''
            }`}
          >
            <div className="answer-tab-header">
              <button
                className="answer-tab-select"
                onClick={() => setSelectedIndex(i)}
              >
                {i === selectedIndex ? '✅' : '○'} 回答 {i + 1}
              </button>
              {candidate.model && (
                <span className="answer-model">{candidate.model}</span>
              )}
              {i !== selectedIndex && (
                <button
                  className={`keep-btn ${keepIndices.includes(i) ? 'active' : ''}`}
                  onClick={() => toggleKeep(i)}
                  title="履歴に残す"
                >
                  📋
                </button>
              )}
            </div>
            {i === selectedIndex && (
              <div className="answer-content markdown-body">
                {candidate.thinking && <ThinkingBlock thinking={candidate.thinking} />}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{candidate.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
      {isRetrying && (
        <div className="answer-streaming">
          <LoadingIndicator message="別のモデルで回答を生成中..." />
        </div>
      )}
      {!isRetrying && (
        <div className="answer-selector-actions">
          <button className="btn-primary" onClick={handleConfirm}>
            ✅ 選択した回答を採用
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ディレクトリツリーモーダルコンポーネント
 */
function DirectoryTreeModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const [tree, setTree] = useState<api.DirectoryNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      loadTree(currentPath);
    }
  }, [isOpen, currentPath]);

  const loadTree = async (path?: string) => {
    setLoading(true);
    try {
      const data = await api.getDirectoryTree(path);
      setTree(data);
    } catch (err) {
      console.error('Failed to load directory tree:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal directory-modal" onClick={(e) => e.stopPropagation()}>
        <h3>📁 プロジェクトフォルダを選択</h3>
        {loading ? (
          <LoadingIndicator message="ディレクトリを読み込み中..." />
        ) : tree ? (
          <div className="directory-tree">
            <DirectoryNode
              node={tree}
              onSelectDirectory={(path) => {
                onSelect(path);
                onClose();
              }}
              onNavigate={(path) => setCurrentPath(path)}
            />
          </div>
        ) : null}
        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

function DirectoryNode({
  node,
  onSelectDirectory,
  onNavigate,
  depth = 0,
}: {
  node: api.DirectoryNode;
  onSelectDirectory: (path: string) => void;
  onNavigate: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (!node.isDirectory) return null;

  return (
    <div className="dir-node" style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="dir-item">
        <button
          className="dir-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="dir-name" onClick={() => onSelectDirectory(node.path)}>
          📁 {node.name}
        </span>
        <button
          className="dir-select-btn"
          onClick={() => onSelectDirectory(node.path)}
        >
          選択
        </button>
      </div>
      {expanded && node.children && (
        <div className="dir-children">
          {node.children
            .filter((child) => child.isDirectory)
            .map((child) => (
              <DirectoryNode
                key={child.path}
                node={child}
                onSelectDirectory={onSelectDirectory}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
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
      setAnswerCandidates(prev => [...prev, newAnswer]);
      setStreamingContent('');
      setStreamingThinking('');
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

  return (
    <div className="chat-container">
      {/* サイドバー */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen(false)}
              title="サイドバーを閉じる"
            >
              ☰
            </button>
            <h2 className="sidebar-logo">llamune_chat</h2>
          </div>
          <button className="new-chat-btn" onClick={() => setShowNewChat(true)}>
            + 新しいチャット
          </button>
          <button className="modes-btn" onClick={onNavigateToModes}>
            ⚙️ パラメータセット管理
          </button>
          <button className="import-btn" onClick={handleImportClick}>
            📤 インポート
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />
        </div>

        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${currentSession === session.id ? 'active' : ''}`}
              onClick={() => setCurrentSession(session.id)}
            >
              <>
                <div className="session-info-row">
                  <button
                    className="session-info-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoverInfoSessionId(
                        hoverInfoSessionId === session.id ? null : session.id
                      );
                    }}
                  >
                    ℹ️
                  </button>
                    {hoverInfoSessionId === session.id && (
                      <div className="session-info-tooltip">
                        <div className="tooltip-row">
                          <span className="tooltip-label">📅 日付:</span>
                          <span>{session.created_at ? formatDate(session.created_at) : '(不明)'}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">🎯 パラメータセット:</span>
                          <span>{session.psets_icon || ''} {session.psets_name || '(なし)'}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">🤖 LLM:</span>
                          <span>{session.model || '(不明)'}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">📁 プロジェクト:</span>
                          <span className="tooltip-path">{session.project_path || '(なし)'}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">💬 チャット数:</span>
                          <span>{session.message_count ?? 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="session-title">
                    {currentSession === session.id && '⭐ '}
                    {session.title || '(無題)'}
                  </span>
                  <div className="session-actions">
                    <button
                      className="session-action-btn export-btn"
                      onClick={(e) => handleExportSession(session.id, e)}
                      title="エクスポート"
                    >
                      📥
                    </button>
                    <button
                      className="session-action-btn edit-btn"
                      onClick={(e) => openSessionEditModal(session, e)}
                      title="編集"
                    >
                      ✏️
                    </button>
                    <button
                      className="session-action-btn delete-btn"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              </div>
            ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <span>👤 {user?.username}</span>
            <button onClick={logout}>ログアウト</button>
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="main-area">
        {!isSidebarOpen && (
          <button
            className="sidebar-open-btn"
            onClick={() => setIsSidebarOpen(true)}
            title="サイドバーを開く"
          >
            ☰
          </button>
        )}

        {/* インポート閲覧モード */}
        {importedData ? (
          <>
            <div className="import-header">
              <div className="import-info">
                <span className="import-badge">📖 閲覧モード</span>
                <span className="import-title">{importedData.session.title || '(無題)'}</span>
                <span className="import-meta">
                  {importedData.session.model} | {importedData.session.created_at ? new Date(importedData.session.created_at).toLocaleDateString() : ''} | {importedData.messages.length}件
                </span>
              </div>
              <button className="import-close-btn" onClick={closeImportView}>
                ✕ 閉じる
              </button>
            </div>
            <div className="messages">
              {importedData.session.systemPrompt && (
                <SystemPromptBlock
                  systemPrompt={importedData.session.systemPrompt}
                  model={importedData.session.model}
                />
              )}
              {importedData.messages.map((msg, i) => {
                const isKeptOnly = msg.role === 'assistant' && msg.is_adopted === false;
                return (
                  <div key={i} className={`message ${msg.role} ${isKeptOnly ? 'kept-only' : ''}`}>
                    <div className="message-header">
                      <div className="message-role">
                        {msg.role === 'user' ? '👤 You' : (
                        <>🤖 AI{msg.model && <span className="message-model-inline"> {msg.model}</span>}</>
                      )}
                      {isKeptOnly && <span className="kept-badge">📋 履歴のみ</span>}
                      </div>
                    </div>
                    {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                    <div className="message-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </>
        ) : (currentSession || pendingNewChat) ? (
          <>
            <div
              className="messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {systemPrompt && (
                <SystemPromptBlock
                  systemPrompt={systemPrompt}
                  psetsIcon={psetsIcon || undefined}
                  psetsName={psetsName || undefined}
                  model={sessionModel || undefined}
                />
              )}
              {messages.map((msg, i) => {
                if (retryPending && i === lastAssistantIndex && msg.role === 'assistant') {
                  return null;
                }

                const isLastAssistant = i === lastAssistantIndex && msg.role === 'assistant';
                const isKeptOnly = msg.role === 'assistant' && msg.is_adopted === false;

                return (
                  <div key={i} className={`message ${msg.role} ${isKeptOnly ? 'kept-only' : ''}`}>
                    <div className="message-header">
                      <div className="message-role">
                        {msg.role === 'user' ? '👤 You' : (
                        <>🤖 AI{msg.model && <span className="message-model-inline"> {msg.model}</span>}</>
                      )}
                      {isKeptOnly && <span className="kept-badge">📋 履歴のみ</span>}
                      </div>
                    </div>
                    {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                    <div className="message-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {isLastAssistant && !loading && !isRetrying && !retryPending && (
                      <button
                        className="retry-btn"
                        onClick={() => setShowRetryModal(true)}
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                );
              })}

              {/* 回答選択ビュー（複数候補対応） */}
              {retryPending && answerCandidates.length > 0 && (
                <AnswerSelector
                  candidates={answerCandidates}
                  onConfirm={handleConfirmSelection}
                  onRetryMore={handleRetryMore}
                  isRetrying={isRetrying}
                  maxCandidates={MAX_CANDIDATES}
                />
              )}

              {/* ストリーミング中（通常送信） */}
              {loading && !isRetrying && (
                <div className="message assistant">
                  <div className="message-role">🤖 AI</div>
                  {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                  {streamingContent ? (
                    <div className="message-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <LoadingIndicator message={streamingThinking ? '回答を作成中...' : '思考中...'} />
                  )}
                </div>
              )}

              {/* リトライ中のストリーミング */}
              {isRetrying && (
                <div className="message assistant streaming-retry">
                  <div className="message-role">🤖 AI (リトライ中)</div>
                  {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                  {streamingContent ? (
                    <div className="message-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <LoadingIndicator message={streamingThinking ? '回答を作成中...' : '別のモデルで思考中...'} />
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="メッセージを入力..."
                disabled={loading || isRetrying || retryPending}
              />
              {loading || isRetrying ? (
                <button className="stop-btn" onClick={handleCancelStreaming}>
                  ⏹️ 停止
                </button>
              ) : (
                <button onClick={handleSend} disabled={retryPending || !input.trim()}>
                  送信
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="no-session">
            <h2>🔵 llamune_chat</h2>
            <p>新しいチャットを開始するか、左のセッションを選択してください</p>
            <button onClick={() => setShowNewChat(true)}>+ 新しいチャット</button>
          </div>
        )}
      </main>

      {/* 新しいチャットモーダル */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新しいチャット</h3>

            <div className="form-group">
              <label>パラメータセット</label>
              <select
                value={selectedTemplate || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedTemplate(id);
                  const tmpl = psetsTemplates.find(t => t.id === id);
                  setSelectedModel(tmpl?.model || '');
                }}
              >
                {psetsTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.icon} {template.psets_name}
                    {template.model ? ` — ${template.model}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* テンプレートにモデル未設定の場合はモデル選択を表示 */}
            {!psetsTemplates.find(t => t.id === selectedTemplate)?.model && (
              <div className="form-group">
                <label>モデル <span style={{color:'red'}}>*</span></label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  <option value="">モデルを選択してください</option>
                  {models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* プロジェクトフォルダ選択 */}
            <div className="form-group">
              <label>プロジェクトフォルダ（オプション）</label>
              <div className="project-path-selector">
                <input
                  type="text"
                  value={selectedProjectPath || ''}
                  readOnly
                  placeholder="フォルダを選択..."
                  className="project-path-input"
                />
                <button
                  type="button"
                  onClick={() => setShowDirectoryModal(true)}
                  className="browse-btn"
                >
                  📁 参照
                </button>
                {selectedProjectPath && (
                  <button
                    type="button"
                    onClick={() => setSelectedProjectPath(null)}
                    className="clear-btn"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => { setShowNewChat(false); setSelectedProjectPath(null); }}>キャンセル</button>
              <button onClick={handleNewChat} className="primary" disabled={!psetsTemplates.find(t => t.id === selectedTemplate)?.model && !selectedModel}>開始</button>
            </div>
          </div>
        </div>
      )}

      {/* セッション編集モーダル */}
      {editingSession && (
        <SessionEditModal
          session={editingSession}
          currentPsets={editingSessionPsets}
          onClose={() => { setEditingSession(null); setEditingSessionPsets(null); }}
          onSave={handleSessionEditSave}
        />
      )}

      {/* ディレクトリ選択モーダル */}
      <DirectoryTreeModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        onSelect={(path) => setSelectedProjectPath(path)}
      />

      {/* リトライモーダル */}
      <RetryModal
        isOpen={showRetryModal}
        onClose={() => setShowRetryModal(false)}
        models={models}
        currentModel={sessionModel || ''}
        onRetry={handleRetry}
      />
    </div>
  );
}
