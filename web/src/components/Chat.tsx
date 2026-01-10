/**
 * チャットコンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Mode, Model, Session, Message } from '../types';
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
 * 回答比較コンポーネント
 */
function CompareAnswers({
  originalAnswer,
  retryAnswer,
  onAccept,
  onReject,
}: {
  originalAnswer: Message;
  retryAnswer: Message;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="compare-answers">
      <div className="compare-header">
        <span>💡 どちらの回答を採用しますか？</span>
      </div>
      <div className="compare-grid">
        {/* 元の回答 */}
        <div className="compare-card original">
          <div className="compare-card-header">
            <span className="compare-label">元の回答</span>
            {originalAnswer.model && (
              <span className="compare-model">{originalAnswer.model}</span>
            )}
          </div>
          {originalAnswer.thinking && (
            <ThinkingBlock thinking={originalAnswer.thinking} />
          )}
          <div className="compare-content">
            {originalAnswer.content}
          </div>
          <button className="compare-btn reject" onClick={onReject}>
            こちらを採用
          </button>
        </div>

        {/* リトライ回答 */}
        <div className="compare-card retry">
          <div className="compare-card-header">
            <span className="compare-label">新しい回答</span>
            {retryAnswer.model && (
              <span className="compare-model">{retryAnswer.model}</span>
            )}
          </div>
          {retryAnswer.thinking && (
            <ThinkingBlock thinking={retryAnswer.thinking} />
          )}
          <div className="compare-content">
            {retryAnswer.content}
          </div>
          <button className="compare-btn accept" onClick={onAccept}>
            こちらを採用
          </button>
        </div>
      </div>
    </div>
  );
}

export function Chat() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // プロジェクトフォルダ関連の状態
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  // リトライ関連の状態
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [originalAnswer, setOriginalAnswer] = useState<Message | null>(null);
  const [retryAnswer, setRetryAnswer] = useState<Message | null>(null);

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
    if (currentSession) {
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

  // 新しいチャット作成
  const handleNewChat = async () => {
    if (!selectedModel || !selectedMode) return;
    
    try {
      const data = await api.createSession(selectedModel, selectedMode, selectedProjectPath || undefined);
      setSessions(prev => [...prev, { ...data.session, message_count: 0 }]);
      setCurrentSession(data.session.id);
      setMessages([]);
      setSystemPrompt(data.systemPrompt || null);
      setSessionModel(data.session?.model || selectedModel);
      setModeDisplayName(data.modeDisplayName || null);
      setModeIcon(data.modeIcon || null);
      setShowNewChat(false);
      setSelectedProjectPath(null); // リセット
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || !currentSession || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreamingContent('');
    setStreamingThinking('');

    // ユーザーメッセージを追加
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      let fullContent = '';
      let fullThinking = '';
      for await (const chunk of api.sendMessage(currentSession, userMessage)) {
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
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
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

  // リトライ実行
  const handleRetry = async (model: string) => {
    if (!currentSession || isRetrying) return;

    // 最後のアシスタントメッセージを保存
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;

    setOriginalAnswer(lastAssistant);
    setIsRetrying(true);
    setStreamingContent('');
    setStreamingThinking('');

    try {
      let fullContent = '';
      let fullThinking = '';
      let retryModel = model;

      for await (const chunk of api.retryMessage(currentSession, model)) {
        fullContent = chunk.content;
        fullThinking = chunk.thinking || '';
        retryModel = chunk.model;
        setStreamingContent(chunk.content);
        setStreamingThinking(chunk.thinking || '');
      }

      // リトライ回答を設定
      setRetryAnswer({
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        model: retryModel,
      });
      setStreamingContent('');
      setStreamingThinking('');
      setRetryPending(true);
    } catch (err) {
      console.error('Failed to retry:', err);
      setOriginalAnswer(null);
    } finally {
      setIsRetrying(false);
    }
  };

  // リトライ回答を採用
  const handleAcceptRetry = async () => {
    if (!currentSession || !retryAnswer) return;

    try {
      await api.acceptRetry(currentSession);
      
      // メッセージを更新（元の回答を削除して新しい回答に置き換え）
      setMessages(prev => {
        const newMessages = [...prev];
        // 最後のアシスタントメッセージを探して置き換え
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].role === 'assistant') {
            newMessages[i] = retryAnswer;
            break;
          }
        }
        return newMessages;
      });

      // 状態をリセット
      setRetryPending(false);
      setOriginalAnswer(null);
      setRetryAnswer(null);
    } catch (err) {
      console.error('Failed to accept retry:', err);
    }
  };

  // リトライ回答を破棄（元の回答を採用）
  const handleRejectRetry = async () => {
    if (!currentSession) return;

    try {
      await api.rejectRetry(currentSession);
      
      // 状態をリセット（メッセージはそのまま）
      setRetryPending(false);
      setOriginalAnswer(null);
      setRetryAnswer(null);
    } catch (err) {
      console.error('Failed to reject retry:', err);
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
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>🦙 Llamune</h2>
          <button className="new-chat-btn" onClick={() => setShowNewChat(true)}>
            + 新しいチャット
          </button>
        </div>

        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${currentSession === session.id ? 'active' : ''}`}
              onClick={() => setCurrentSession(session.id)}
            >
              <span className="session-title">
                {session.title || '(無題)'}
              </span>
              <button
                className="delete-btn"
                onClick={(e) => handleDeleteSession(session.id, e)}
              >
                ×
              </button>
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
        {currentSession ? (
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

                return (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-header">
                      <div className="message-role">
                        {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                      </div>
                      {msg.model && msg.role === 'assistant' && (
                        <span className="message-model">{msg.model}</span>
                      )}
                    </div>
                    {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}
                    <div className="message-content">
                      {msg.content}
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

              {/* リトライ比較ビュー */}
              {retryPending && originalAnswer && retryAnswer && (
                <CompareAnswers
                  originalAnswer={originalAnswer}
                  retryAnswer={retryAnswer}
                  onAccept={handleAcceptRetry}
                  onReject={handleRejectRetry}
                />
              )}

              {/* ストリーミング中（通常送信） */}
              {(streamingContent || streamingThinking) && !isRetrying && (
                <div className="message assistant">
                  <div className="message-role">🤖 AI</div>
                  {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                  <div className="message-content">{streamingContent}</div>
                </div>
              )}

              {/* リトライ中のストリーミング */}
              {isRetrying && (
                <div className="message assistant streaming-retry">
                  <div className="message-role">🤖 AI (リトライ中...)</div>
                  {streamingThinking && <ThinkingBlock thinking={streamingThinking} />}
                  <div className="message-content">{streamingContent || '生成中...'}</div>
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
              <button onClick={handleSend} disabled={loading || isRetrying || retryPending || !input.trim()}>
                {loading || isRetrying ? '...' : '送信'}
              </button>
            </div>
          </>
        ) : (
          <div className="no-session">
            <h2>🦙 Llamune</h2>
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
