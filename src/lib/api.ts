import { getIdToken } from "./firebase";
import type {
  ArticleSummary,
  Article,
  DeploymentMap,
  CreateArticleInput,
  UpdateArticleInput,
} from "./types";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `エラーが発生しました (${res.status})`);
  }

  const json = await res.json();
  return json.data as T;
}

// request() は非OKレスポンスを一律エラーにするが、
// ここでは403を正常な「未許可」として扱うため直接fetchする
export async function checkAuth(): Promise<{ authorized: boolean }> {
  const token = await getIdToken();
  const res = await fetch("/api/auth/check", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return { authorized: true };
  if (res.status === 403) return { authorized: false };
  throw new Error(`認証チェックに失敗しました (${res.status})`);
}

export function fetchArticles(): Promise<ArticleSummary[]> {
  return request<ArticleSummary[]>("/api/articles");
}

export function fetchDeployments(): Promise<DeploymentMap> {
  return request<DeploymentMap>("/api/deployments");
}

export function fetchArticle(id: number): Promise<Article> {
  return request<Article>(`/api/articles/${id}`);
}

export function createArticle(
  input: CreateArticleInput,
): Promise<{ id: number }> {
  return request("/api/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateArticle(
  id: number,
  input: UpdateArticleInput,
): Promise<void> {
  return request(`/api/articles/${id}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function publishArticle(pullNumber: number): Promise<void> {
  return request("/api/publish", {
    method: "POST",
    body: JSON.stringify({ pullNumber }),
  });
}

export async function fetchImageUrl(proxyUrl: string): Promise<string> {
  const token = await getIdToken();
  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("画像の取得に失敗しました");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
