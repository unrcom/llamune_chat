/**
 * チャットコンポーネント
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Mode, Model, Session, Message } from '../types';
import * as api from '../api/client';
import './Chat.css';

export function Chat() {
  const { user, logout } = useAuth();
  const [modes, setModes] = useState<Mode[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedMode, setSelectedMode] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        } catch (err) {
          console.error('Failed to fetch messages:', err);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
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
      const data = await api.createSession(selectedModel, selectedMode);
      setSessions(prev => [...prev, { ...data.session, message_count: 0 }]);
      setCurrentSession(data.session.id);
      setMessages([]);
      setShowNewChat(false);
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

    // ユーザーメッセージを追加
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      let fullContent = '';
      for await (const chunk of api.sendMessage(currentSession, userMessage)) {
        fullContent = chunk.content;
        setStreamingContent(chunk.content);
      }

      // ストリーミング完了後、アシスタントメッセージを追加
      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');

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
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-role">
                    {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                  </div>
                  <div className="message-content">
                    {msg.content}
                  </div>
                </div>
              ))}
              {streamingContent && (
                <div className="message assistant">
                  <div className="message-role">🤖 AI</div>
                  <div className="message-content">{streamingContent}</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="メッセージを入力..."
                disabled={loading}
              />
              <button onClick={handleSend} disabled={loading || !input.trim()}>
                {loading ? '...' : '送信'}
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

            <div className="modal-actions">
              <button onClick={() => setShowNewChat(false)}>キャンセル</button>
              <button onClick={handleNewChat} className="primary">開始</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
