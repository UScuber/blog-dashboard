import { Routes, Route, Link } from 'react-router-dom';
import ArticleList from './components/ArticleList';
import ArticleEditor from './components/ArticleEditor';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-title">記事管理ダッシュボード</Link>
          <nav className="header-nav">
            <Link to="/">記事一覧</Link>
            <Link to="/new" className="btn btn-primary btn-sm">新規作成</Link>
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
