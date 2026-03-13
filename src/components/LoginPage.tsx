import { useState } from "react";
import { signInWithGoogle } from "../lib/firebase";
import { Button } from "./ui/button";

interface LoginPageProps {
  initialError?: string;
}

export function LoginPage({ initialError = "" }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "ログインに失敗しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-xl px-10 py-12 shadow-md text-center max-w-[420px] w-full max-md:mx-4 max-md:px-6 max-md:py-8">
        <h1 className="text-2xl font-bold mb-3">記事管理ダッシュボード</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          ブログ記事の作成・編集・公開を行うダッシュボードです。
          <br />
          Googleアカウントでログインしてください。
        </p>
        {error && (
          <p className="text-red-600 text-[13px] mb-4 px-3 py-2 bg-red-50 rounded-md">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          size="lg"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "ログイン中..." : "Google でログイン"}
        </Button>
      </div>
    </div>
  );
}
