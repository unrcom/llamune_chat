/**
 * Llamune Web アプリケーション
 */

import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Chat } from './components/Chat';
import './App.css';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  return user ? <Chat /> : <Login />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
