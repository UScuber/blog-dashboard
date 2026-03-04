import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from './lib/firebase';
import ArticleList from './components/ArticleList';
import ArticleEditor from './components/ArticleEditor';
import LoginPage from './components/LoginPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-title">記事管理ダッシュボード</Link>
          <nav className="header-nav">
            <Link to="/">記事一覧</Link>
            <Link to="/new" className="btn btn-primary btn-sm">新規作成</Link>
            <span className="user-email">{user.email}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
              ログアウト
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ArticleList />} />
          <Route path="/new" element={<ArticleEditor />} />
          <Route path="/edit/:id" element={<ArticleEditor />} />
        </Routes>
      </main>
    </div>
  );
}
