/**
 * ログインコンポーネント
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

export function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🔵 llamune</h1>
        <p className="subtitle">ローカルLLMコーディング支援</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">ユーザー名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名"
              required
              minLength={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              minLength={4}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? '処理中...' : isRegister ? '登録' : 'ログイン'}
          </button>
        </form>

        <p className="toggle">
          {isRegister ? (
            <>
              アカウントをお持ちですか？{' '}
              <button onClick={() => setIsRegister(false)}>ログイン</button>
            </>
          ) : (
            <>
              アカウントがありませんか？{' '}
              <button onClick={() => setIsRegister(true)}>新規登録</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
