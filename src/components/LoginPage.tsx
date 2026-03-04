import { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>記事管理ダッシュボード</h1>
        <p>ログインして記事の作成・管理を行います。</p>
        {error && <div className="error-message"><p>{error}</p></div>}
        <button
          className="btn btn-primary login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'ログイン中...' : 'Google でログイン'}
        </button>
      </div>
    </div>
  );
}
