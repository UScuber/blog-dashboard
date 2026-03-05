import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchArticles, publishArticle } from '../lib/api';
import type { Article } from '../lib/types';

export default function ArticleList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadArticles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchArticles();
      setArticles(data);
    } catch (err: any) {
      setError(err.message || '記事の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handlePublish = async (pullNumber: number) => {
    if (!window.confirm('本当に公開しますか？公開するとPRがマージされ、本番サイトに反映されます。')) {
      return;
    }
    setPublishingId(pullNumber);
    try {
      await publishArticle(pullNumber);
      await loadArticles();
    } catch (err: any) {
      alert(`公開に失敗しました: ${err.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const displayTitle = (title: string) => {
    return title.replace(/^post:\s*/, '');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p className="loading-text">記事一覧を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={loadArticles}>再試行</button>
      </div>
    );
  }

  return (
    <div className="article-list">
      <div className="page-header">
        <h1>記事管理</h1>
        <button className="btn btn-primary" onClick={() => navigate('/new')}>
          新規作成
        </button>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state">
          <p>編集中の記事はありません</p>
          <button className="btn btn-primary" onClick={() => navigate('/new')}>
            最初の記事を作成する
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {articles.map((article) => (
            <div key={article.id} className="card">
              <div className="card-body">
                <h2 className="card-title">{displayTitle(article.title)}</h2>
                <div className="card-meta">
                  <span>作成: {formatDate(article.createdAt)}</span>
                  <span>更新: {formatDate(article.updatedAt)}</span>
                </div>
                <span className="badge badge-editing">編集中</span>
              </div>
              <div className="card-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/edit/${article.id}`)}
                >
                  編集
                </button>
                {article.previewStatus === 'building' ? (
                  <button className="btn btn-secondary" disabled>
                    <span className="btn-spinner" /> デプロイ中...
                  </button>
                ) : article.previewStatus === 'pending' ? (
                  <button className="btn btn-secondary" disabled>
                    デプロイ準備中
                  </button>
                ) : article.previewUrl ? (
                  <a
                    className="btn btn-secondary"
                    href={article.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    プレビュー
                  </a>
                ) : (
                  <span className="btn btn-ghost" style={{ cursor: 'default' }}>
                    プレビューなし
                  </span>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => handlePublish(article.id)}
                  disabled={publishingId === article.id}
                >
                  {publishingId === article.id ? '公開中...' : '公開'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
