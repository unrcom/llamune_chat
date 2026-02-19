/**
 * Llamune_chat Web アプリケーション
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Chat } from './components/Chat';
import { ParameterSetsManagement } from './components/ParameterSetsManagement';
import './App.css';

type Page = 'chat' | 'psets';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('chat');

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      {currentPage === 'chat' && <Chat onNavigateToModes={() => setCurrentPage('psets')} />}
      {currentPage === 'psets' && <ParameterSetsManagement onNavigateToChat={() => setCurrentPage('chat')} />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
