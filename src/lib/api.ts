import { getIdToken } from "./firebase";
import type {
  ArticleSummary,
  Article,
  DeploymentMap,
  CreateArticleInput,
  UpdateArticleInput,
} from "./types";

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
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

export function fetchArticles(): Promise<ArticleSummary[]> {
  return request<ArticleSummary[]>("/api/articles");
}

export function fetchDeployments(): Promise<DeploymentMap> {
  return request<DeploymentMap>("/api/deployments");
}

export function fetchArticle(id: number): Promise<Article> {
  return request<Article>(`/api/articles/${id}`);
}

export function createArticle(input: CreateArticleInput): Promise<{ id: number }> {
  return request("/api/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateArticle(
  id: number,
  input: UpdateArticleInput
): Promise<void> {
  return request(`/api/articles/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function publishArticle(pullNumber: number): Promise<void> {
  return request("/api/publish", {
    method: "POST",
    body: JSON.stringify({ pullNumber }),
  });
}
