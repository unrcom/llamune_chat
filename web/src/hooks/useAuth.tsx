/**
 * 認証コンテキスト
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import * as api from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初期化時に認証状態を確認
    const checkAuth = async () => {
      try {
        if (api.getAccessToken()) {
          const userData = await api.getMe();
          setUser(userData);
        }
      } catch {
        api.clearTokens();
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const userData = await api.login(username, password);
    setUser(userData);
  };

  const register = async (username: string, password: string) => {
    const userData = await api.register(username, password);
    setUser(userData);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
