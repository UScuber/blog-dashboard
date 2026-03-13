import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchArticles, fetchDeployments, publishArticle } from "../lib/api";
import { showToast } from "../lib/toast";
import type { ArticleSummary, DeploymentMap } from "../lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LoadingScreen } from "./LoadingScreen";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";

export function ArticleList() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [deployments, setDeployments] = useState<DeploymentMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [arts, deps] = await Promise.allSettled([
        fetchArticles(),
        fetchDeployments(),
      ]);

      if (arts.status === "fulfilled") {
        setArticles(arts.value);
      } else {
        throw arts.reason;
      }

      if (deps.status === "fulfilled") {
        setDeployments(deps.value);
      } else {
        setDeployments(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "記事一覧の取得に失敗しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (loading || error) return;

    const id = setInterval(async () => {
      try {
        const deps = await fetchDeployments();
        setDeployments(deps);
      } catch {
        // ポーリング失敗時は既存データを維持
      }
    }, 10 * 1000);

    return () => clearInterval(id);
  }, [loading, error]);

  const handlePublish = async (article: ArticleSummary) => {
    if (
      !window.confirm(
        `「${article.title.replace("post: ", "")}」を公開しますか？`,
      )
    ) {
      return;
    }
    setPublishingId(article.id);
    try {
      await publishArticle(article.id);
      showToast("記事を公開しました", "success");
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "公開に失敗しました";
      showToast(message, "error");
    } finally {
      setPublishingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderPreviewButton = (article: ArticleSummary) => {
    if (!deployments) {
      return (
        <Button variant="secondary" size="sm" disabled className="opacity-50">
          プレビューなし
        </Button>
      );
    }

    const dep = deployments[article.branch];
    if (!dep || dep.previewStatus === "pending") {
      return (
        <Button variant="secondary" size="sm" disabled>
          デプロイ準備中
        </Button>
      );
    }
    if (dep.previewStatus === "building") {
      return (
        <Button variant="secondary" size="sm" disabled>
          <Spinner size="sm" /> デプロイ中...
        </Button>
      );
    }
    if (dep.previewStatus === "ready" && dep.previewUrl) {
      return (
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={dep.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          プレビュー
        </Button>
      );
    }
    return (
      <Button variant="secondary" size="sm" disabled>
        デプロイ準備中
      </Button>
    );
  };

  if (loading) {
    return <LoadingScreen message="記事一覧を読み込み中..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-15 px-5 gap-4 text-red-600">
        <p>{error}</p>
        <Button onClick={loadData}>再試行</Button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-6 max-md:flex-col max-md:items-stretch max-md:gap-3">
          <h1 className="text-2xl font-bold">記事管理</h1>
          <Button className="max-md:w-full" onClick={() => navigate("/new")}>
            新規作成
          </Button>
        </div>
        <EmptyState
          message="編集中の記事はありません"
          actionLabel="最初の記事を作成する"
          onAction={() => navigate("/new")}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 max-md:flex-col max-md:items-stretch max-md:gap-3">
        <h1 className="text-2xl font-bold">記事管理</h1>
        <Button className="max-md:w-full" onClick={() => navigate("/new")}>
          新規作成
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 max-md:grid-cols-1">
        {articles.map((article) => (
          <div
            key={article.id}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-shadow hover:shadow-md"
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {article.title.replace(/^post:\s*/, "")}
                </h2>
                <Badge variant="info">編集中</Badge>
              </div>
              <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                <span>作成: {formatDate(article.createdAt)}</span>
                <span>更新: {formatDate(article.updatedAt)}</span>
              </div>
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/80 max-md:[&>*]:flex-1">
              <Button size="sm" onClick={() => navigate(`/edit/${article.id}`)}>
                編集
              </Button>
              {renderPreviewButton(article)}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handlePublish(article)}
                disabled={publishingId === article.id}
              >
                {publishingId === article.id ? (
                  <>
                    <Spinner size="sm" /> 公開中...
                  </>
                ) : (
                  "公開"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
