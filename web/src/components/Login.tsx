/**
 * ログインコンポーネント
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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
    <div className="flex justify-center items-center min-h-screen bg-[#1a1a2e]">
      <div className="bg-[#16213e] p-8 rounded-xl w-full max-w-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <h1 className="text-center text-2xl font-bold text-white mb-2">🔵 llamune_chat</h1>
        <p className="text-center text-[#888] mb-8">ローカルLLMコーディング支援</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-[#ccc] text-sm mb-2">ユーザー名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名"
              required
              minLength={3}
              className="w-full px-3 py-3 border border-[#333] rounded-md bg-[#0f0f23] text-white text-base focus:outline-none focus:border-[#4a9eff]"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-[#ccc] text-sm mb-2">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              minLength={4}
              className="w-full px-3 py-3 border border-[#333] rounded-md bg-[#0f0f23] text-white text-base focus:outline-none focus:border-[#4a9eff]"
            />
          </div>

          {error && (
            <div className="bg-[#ff4444] text-white px-3 py-3 rounded-md mb-4 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4a9eff] text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-[#3a8eef] disabled:bg-[#555] disabled:cursor-not-allowed"
          >
            {loading ? '処理中...' : isRegister ? '登録' : 'ログイン'}
          </button>
        </form>

        <p className="text-center mt-6 text-[#888] text-sm">
          {isRegister ? (
            <>
              アカウントをお持ちですか？{' '}
              <button onClick={() => setIsRegister(false)} className="bg-transparent border-none text-[#4a9eff] cursor-pointer text-sm hover:underline">ログイン</button>
            </>
          ) : (
            <>
              アカウントがありませんか？{' '}
              <button onClick={() => setIsRegister(true)} className="bg-transparent border-none text-[#4a9eff] cursor-pointer text-sm hover:underline">新規登録</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
