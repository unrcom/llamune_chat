/**
 * チャットコンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth';
import type { Mode, Model, Session, Message, ImportedSession } from '../types';
import * as api from '../api/client';
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
  modeIcon,
  modeDisplayName,
  model,
}: { 
  systemPrompt: string;
  modeIcon?: string;
  modeDisplayName?: string;
  model?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // ヘッダーテキストを構築
  const headerParts: string[] = [];
  if (modeIcon) headerParts.push(modeIcon);
  if (modeDisplayName) headerParts.push(modeDisplayName);
  if (model) headerParts.push(`(${model})`);
  
  const headerText = headerParts.length > 0 
    ? `${headerParts.join(' ')} のシステムプロンプト`
    : '📋 システムプロンプト';

  return (
    <div className="system-prompt-block">
      <button
        className="system-prompt-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="system-prompt-icon">{isOpen ? '▼' : '▶'}</span>
        <span>{headerText}</span>
      </button>
      {isOpen && (
        <div className="system-prompt-content">
          {systemPrompt}
        </div>
      )}
    </div>
  );
}

/**
 * リトライモーダル（モデル選択）
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
        <h3>🔄 別のモデルで再生成</h3>
        <p className="retry-description">モデルを選択してください</p>
        
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
 * ディレクトリツリーアイテム
 */
function DirectoryItem({
  node,
  onExpand,
  onSelect,
  selectedPath,
  expandedPaths,
}: {
  node: api.DirectoryNode;
  onExpand: (path: string) => void;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  expandedPaths: Set<string>;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isExpanded) {
      onSelect(node.path);
    } else {
      onExpand(node.path);
    }
  };

  return (
    <div className="directory-item-wrapper">
      <div
        className={`directory-item ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <span className="directory-icon">{isExpanded ? '📂' : '📁'}</span>
        <span className="directory-name">{node.name}</span>
      </div>
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="directory-children">
          {node.children.map((child) => (
            <DirectoryItem
              key={child.path}
              node={child}
              onExpand={onExpand}
              onSelect={onSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ディレクトリ選択モーダル
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
  const [rootNode, setRootNode] = useState<api.DirectoryNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初期ロード
  useEffect(() => {
    if (isOpen && !rootNode) {
      loadDirectory();
    }
  }, [isOpen]);

  const loadDirectory = async (path?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDirectoryTree(path);

      if (path) {
        setRootNode((prevRoot) => {
          if (!prevRoot) return data;
          return updateNodeChildren(prevRoot, path, data.children || []);
        });
      } else {
        setRootNode(data);
        setExpandedPaths(new Set([data.path]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const updateNodeChildren = (
    node: api.DirectoryNode,
    targetPath: string,
    children: api.DirectoryNode[]
  ): api.DirectoryNode => {
    if (node.path === targetPath) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) =>
          updateNodeChildren(child, targetPath, children)
        ),
      };
    }
    return node;
  };

  const handleExpand = async (path: string) => {
    const newExpandedPaths = new Set(expandedPaths);
    if (newExpandedPaths.has(path)) {
      newExpandedPaths.delete(path);
      setExpandedPaths(newExpandedPaths);
    } else {
      newExpandedPaths.add(path);
      setExpandedPaths(newExpandedPaths);
      await loadDirectory(path);
    }
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal directory-modal" onClick={(e) => e.stopPropagation()}>
        <h3>📁 プロジェクトフォルダを選択</h3>

        <div className="directory-tree">
          {loading && !rootNode && (
            <div className="directory-loading">読み込み中...</div>
          )}
          {error && (
            <div className="directory-error">{error}</div>
          )}
          {rootNode && (
            <DirectoryItem
              node={rootNode}
              onExpand={handleExpand}
              onSelect={handleSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
            />
          )}
        </div>

        {selectedPath && (
          <div className="directory-selected">
            <span className="directory-selected-label">選択中:</span>
            <span className="directory-selected-path">{selectedPath}</span>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
          <button 
            onClick={handleConfirm} 
            className="primary"
            disabled={!selectedPath}
          >
            選択
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 回答の選択状態
 */
type AnswerAction = 'adopt' | 'keep' | 'discard' | null;

/**
 * 回答選択コンポーネント（複数回答スタック対応・3択）
 */
function AnswerSelector({
  candidates,
  onConfirm,
  onRetryMore,
  isRetrying,
  maxCandidates = 8,
}: {
  candidates: Message[];
  onConfirm: (adoptedIndex: number, keepIndices: number[], discardIndices: number[]) => void;
  onRetryMore: () => void;
  isRetrying: boolean;
  maxCandidates?: number;
}) {
  // 各候補の選択状態を管理
  const [actions, setActions] = useState<AnswerAction[]>(() => 
    candidates.map(() => null)
  );

  // 候補数が変わったらactionsを更新
  useEffect(() => {
    setActions(prev => {
      if (prev.length < candidates.length) {
        return [...prev, ...Array(candidates.length - prev.length).fill(null)];
      }
      return prev.slice(0, candidates.length);
    });
  }, [candidates.length]);

  // 採用が1つ選択されているか
  const hasAdopted = actions.includes('adopt');
  
  // 全候補にアクションが設定されているか
  const allSelected = actions.every(a => a !== null);
  
  // 確定可能か
  const canConfirm = hasAdopted && allSelected && !isRetrying;

  // アクションを設定
  const setAction = (index: number, action: AnswerAction) => {
    setActions(prev => {
      const newActions = [...prev];
      // 採用は1つだけなので、他の採用を解除
      if (action === 'adopt') {
        for (let i = 0; i < newActions.length; i++) {
          if (newActions[i] === 'adopt') {
            newActions[i] = null;
          }
        }
      }
      newActions[index] = action;
      return newActions;
    });
  };

  // 確定処理
  const handleConfirm = () => {
    const adoptedIndex = actions.findIndex(a => a === 'adopt');
    const keepIndices = actions
      .map((a, i) => a === 'keep' ? i : -1)
      .filter(i => i !== -1);
    const discardIndices = actions
      .map((a, i) => a === 'discard' ? i : -1)
      .filter(i => i !== -1);
    
    onConfirm(adoptedIndex, keepIndices, discardIndices);
  };

  return (
    <div className="answer-selector">
      <div className="answer-selector-header">
        <span>💡 各回答のアクションを選択してください（{candidates.length}個の候補）</span>
        <div className="answer-selector-hint">
          ※「採用」は1つ必須です
        </div>
      </div>
      <div className="answer-candidates">
        {candidates.map((candidate, index) => (
          <div 
            key={index} 
            className={`answer-card ${actions[index] || ''} ${index === 0 ? 'original' : 'retry'}`}
          >
            <div className="answer-card-header">
              <span className="answer-label">
                {index === 0 ? '元の回答' : `回答 ${index + 1}`}
              </span>
              {candidate.model && (
                <span className="answer-model">{candidate.model}</span>
              )}
              {actions[index] && (
                <span className={`answer-status ${actions[index]}`}>
                  {actions[index] === 'adopt' && '✓ 採用'}
                  {actions[index] === 'keep' && '📋 履歴に残す'}
                  {actions[index] === 'discard' && '🗑️ 破棄'}
                </span>
              )}
            </div>
            {candidate.thinking && (
              <ThinkingBlock thinking={candidate.thinking} />
            )}
            <div className="answer-content">
              {candidate.content}
            </div>
            <div className="answer-actions">
              <button
                className={`answer-action-btn adopt ${actions[index] === 'adopt' ? 'active' : ''}`}
                onClick={() => setAction(index, 'adopt')}
                disabled={isRetrying}
              >
                ✓ 採用
              </button>
              <button
                className={`answer-action-btn keep ${actions[index] === 'keep' ? 'active' : ''}`}
                onClick={() => setAction(index, 'keep')}
                disabled={isRetrying}
              >
                📋 履歴に残す
              </button>
              <button
                className={`answer-action-btn discard ${actions[index] === 'discard' ? 'active' : ''}`}
                onClick={() => setAction(index, 'discard')}
                disabled={isRetrying}
              >
                🗑️ 破棄
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="answer-selector-footer">
        {candidates.length < maxCandidates && (
          <button
            className="retry-more-btn"
            onClick={onRetryMore}
            disabled={isRetrying}
          >
            {isRetrying ? '生成中...' : '🔄 別のモデルでもう1つ生成'}
          </button>
        )}
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          決定
        </button>
      </div>
    </div>
  );
}

export function Chat({ onNavigateToModes }: { onNavigateToModes: () => void }) {
  const { user, logout } = useAuth();
  const [modes, setModes] = useState<Mode[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [modeDisplayName, setModeDisplayName] = useState<string | null>(null);
  const [modeIcon, setModeIcon] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedMode, setSelectedMode] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // プロジェクトフォルダ関連の状態
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  // セッション編集関連の状態
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
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

  // 新規チャット準備状態（DBに未作成）
  const [pendingNewChat, setPendingNewChat] = useState<{
    model: string;
    modeId: number;
    projectPath: string | null;
    systemPrompt: string | null;
    modeDisplayName: string | null;
    modeIcon: string | null;
  } | null>(null);

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modesData, modelsData, sessionsData] = await Promise.all([
          api.getModes(),
          api.getModels(),
          api.getSessions(),
        ]);
        setModes(modesData);
        setModels(modelsData);
        setSessions(sessionsData);
        if (modelsData.length > 0) {
          setSelectedModel(modelsData[0].name);
        }
        if (modesData.length > 0) {
          setSelectedMode(modesData[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, []);

  // セッション選択時にメッセージを取得
  useEffect(() => {
    // セッション切り替え時にリトライ関連stateをリセット
    setRetryPending(false);
    setAnswerCandidates([]);
    setIsRetrying(false);
    setStreamingContent('');
    setStreamingThinking('');
    
    if (currentSession) {
      // 既存セッション選択時はpendingNewChatをクリア
      setPendingNewChat(null);
      
      const fetchMessages = async () => {
        try {
          const data = await api.getSession(currentSession);
          setMessages(data.messages || []);
          setSystemPrompt(data.systemPrompt || null);
          setSessionModel(data.session?.model || null);
          setModeDisplayName(data.modeDisplayName || null);
          setModeIcon(data.modeIcon || null);
        } catch (err) {
          console.error('Failed to fetch messages:', err);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setSystemPrompt(null);
      setSessionModel(null);
      setModeDisplayName(null);
      setModeIcon(null);
    }
  }, [currentSession]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 新しいチャット作成（準備状態にするだけ、DBには作成しない）
  const handleNewChat = async () => {
    if (!selectedModel || !selectedMode) return;
    
    try {
      // モード情報を取得
      const modeData = await api.getMode(selectedMode);
      
      // 準備状態を設定（DBにはまだ作成しない）
      setPendingNewChat({
        model: selectedModel,
        modeId: selectedMode,
        projectPath: selectedProjectPath,
        systemPrompt: modeData.system_prompt || null,
        modeDisplayName: modeData.display_name || null,
        modeIcon: modeData.icon || null,
      });
      
      // UIを新規チャット状態に
      setCurrentSession(null);
      setMessages([]);
      setSystemPrompt(modeData.system_prompt || null);
      setSessionModel(selectedModel);
      setModeDisplayName(modeData.display_name || null);
      setModeIcon(modeData.icon || null);
      setShowNewChat(false);
      setSelectedProjectPath(null);
    } catch (err) {
      console.error('Failed to prepare new chat:', err);
    }
  };

  // メッセージ送信
  const handleSend = async () => {
    // pendingNewChatがある場合、またはcurrentSessionがある場合に送信可能
    if (!input.trim() || loading) return;
    if (!currentSession && !pendingNewChat) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreamingContent('');
    setStreamingThinking('');

    // AbortControllerを作成
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // ユーザーメッセージを追加
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // 新規チャットの場合、まずセッションを作成
      let sessionId = currentSession;
      if (!sessionId && pendingNewChat) {
        const data = await api.createSession(
          pendingNewChat.model,
          pendingNewChat.modeId,
          pendingNewChat.projectPath || undefined
        );
        sessionId = data.session.id;
        setCurrentSession(sessionId);
        setPendingNewChat(null); // 準備状態をクリア
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

      // ストリーミング完了後、アシスタントメッセージを追加
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: fullContent,
        thinking: fullThinking || undefined,
      }]);
      setStreamingContent('');
      setStreamingThinking('');

      // セッション一覧を更新
      const sessionsData = await api.getSessions();
      setSessions(sessionsData);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Message sending cancelled by user');
        // キャンセル時は最後のユーザーメッセージを削除して入力欄に戻す
        setMessages(prev => {
          const newMessages = [...prev];
          // 最後のユーザーメッセージを探して削除
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

      // 簡易バリデーション
      if (!data.session || !data.messages) {
        throw new Error('Invalid file format');
      }

      // インポートデータを設定（閲覧モードに入る）
      setImportedData(data);
      setCurrentSession(null); // 通常セッションの選択を解除
    } catch (err) {
      console.error('Failed to import:', err);
      alert('インポートに失敗しました。ファイル形式を確認してください。');
    } finally {
      // ファイル入力をリセット（同じファイルを再選択できるように）
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 閲覧モードを終了
  const closeImportView = () => {
    setImportedData(null);
  };

  // セッションタイトル編集開始
  const startEditingTitle = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // セッションタイトル保存
  const saveSessionTitle = async () => {
    if (editingSessionId === null) return;

    try {
      await api.updateSessionTitle(editingSessionId, editingTitle);
      setSessions(prev => prev.map(s =>
        s.id === editingSessionId ? { ...s, title: editingTitle } : s
      ));
    } catch (err) {
      console.error('Failed to update title:', err);
    } finally {
      setEditingSessionId(null);
      setEditingTitle('');
    }
  };

  // タイトル編集キャンセル
  const cancelEditingTitle = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // タイトル編集キー操作
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSessionTitle();
    } else if (e.key === 'Escape') {
      cancelEditingTitle();
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

  // リトライ実行（初回または追加）
  const handleRetry = async (model: string) => {
    if (!currentSession || isRetrying) return;

    // 初回リトライの場合、元の回答を候補に追加
    if (answerCandidates.length === 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant) return;
      setAnswerCandidates([lastAssistant]);
    }

    setIsRetrying(true);
    setStreamingContent('');
    setStreamingThinking('');

    // AbortControllerを作成
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

      // 新しい回答を候補に追加
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
      // キャンセル時、候補が1つしかない場合はリセット
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
      // 新しいAPIを呼び出し
      await api.selectRetry(currentSession, adoptedIndex, keepIndices, discardIndices);
      
      // メッセージを更新
      setMessages(prev => {
        const newMessages = [...prev];
        // 最後のアシスタントメッセージを探す
        let lastAssistantIdx = -1;
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'assistant') {
            lastAssistantIdx = i;
            break;
          }
        }
        
        if (lastAssistantIdx !== -1) {
          // 採用した回答で置き換え
          newMessages[lastAssistantIdx] = { ...adoptedAnswer, is_adopted: true };
          
          // 履歴に残す回答を追加（is_adopted: false）
          const keptMessages = keptAnswers.map(answer => ({
            ...answer,
            is_adopted: false,
          }));
          
          // 採用した回答の後に履歴に残す回答を挿入
          newMessages.splice(lastAssistantIdx + 1, 0, ...keptMessages);
        }
        
        return newMessages;
      });

      // 状態をリセット
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
            <h2 className="sidebar-logo">llamune</h2>
          </div>
          <button className="new-chat-btn" onClick={() => setShowNewChat(true)}>
            + 新しいチャット
          </button>
          <button className="modes-btn" onClick={onNavigateToModes}>
            ⚙️ モード管理
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
              onClick={() => editingSessionId !== session.id && setCurrentSession(session.id)}
            >
              {editingSessionId === session.id ? (
                <div className="session-edit">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={saveSessionTitle}
                    className="session-edit-input"
                  />
                </div>
              ) : (
                <>
                  <div
                    className="session-info-wrapper"
                    onMouseEnter={() => setHoverInfoSessionId(session.id)}
                    onMouseLeave={() => setHoverInfoSessionId(null)}
                  >
                    <button
                      className="session-action-btn info-btn"
                      onClick={(e) => e.stopPropagation()}
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
                          <span className="tooltip-label">🎯 モード:</span>
                          <span>{session.mode_icon || ''} {session.mode_display_name || '(なし)'}</span>
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
                      onClick={(e) => startEditingTitle(session, e)}
                      title="タイトル編集"
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
              )}
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
        {/* サイドバーが閉じている時の開くボタン */}
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
                        {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                        {isKeptOnly && <span className="kept-badge">📋 履歴のみ</span>}
                      </div>
                      {msg.model && msg.role === 'assistant' && (
                        <span className="message-model">{msg.model}</span>
                      )}
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
            <div className="messages">
              {systemPrompt && (
                <SystemPromptBlock 
                  systemPrompt={systemPrompt}
                  modeIcon={modeIcon || undefined}
                  modeDisplayName={modeDisplayName || undefined}
                  model={sessionModel || undefined}
                />
              )}
              {/* リトライ比較中は最後のアシスタントメッセージを非表示 */}
              {messages.map((msg, i) => {
                // リトライ比較中は最後のアシスタントメッセージをスキップ
                if (retryPending && i === lastAssistantIndex && msg.role === 'assistant') {
                  return null;
                }

                const isLastAssistant = i === lastAssistantIndex && msg.role === 'assistant';
                const isKeptOnly = msg.role === 'assistant' && msg.is_adopted === false;

                return (
                  <div key={i} className={`message ${msg.role} ${isKeptOnly ? 'kept-only' : ''}`}>
                    <div className="message-header">
                      <div className="message-role">
                        {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                        {isKeptOnly && <span className="kept-badge">📋 履歴のみ</span>}
                      </div>
                      {msg.model && msg.role === 'assistant' && (
                        <span className="message-model">{msg.model}</span>
                      )}
                    </div>
                    {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                    <div className="message-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {/* 最後のアシスタントメッセージにリトライボタン */}
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
            <h2>🔵 llamune</h2>
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
              <label>モード</label>
              <select
                value={selectedMode || ''}
                onChange={(e) => setSelectedMode(Number(e.target.value))}
              >
                {modes.map(mode => (
                  <option key={mode.id} value={mode.id}>
                    {mode.icon} {mode.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>モデル</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {models.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.sizeFormatted})
                  </option>
                ))}
              </select>
            </div>

            {/* プロジェクトフォルダ - 「あなたの本職を支援」モードの時のみ表示 */}
            {modes.find(m => m.id === selectedMode)?.display_name === 'あなたの本職を支援' && (
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
            )}

            <div className="modal-actions">
              <button onClick={() => { setShowNewChat(false); setSelectedProjectPath(null); }}>キャンセル</button>
              <button onClick={handleNewChat} className="primary">開始</button>
            </div>
          </div>
        </div>
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
        currentModel={selectedModel}
        onRetry={handleRetry}
      />
    </div>
  );
}
