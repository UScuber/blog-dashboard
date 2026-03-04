import type { Article, CreateArticleInput, UpdateArticleInput, UploadImageInput } from './types';
import { getIdToken } from './firebase';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchArticles(): Promise<Article[]> {
  const headers = await authHeaders();
  const result = await request<{ success: boolean; data: Article[] }>('/api/articles', { headers });
  return result.data;
}

export async function createArticle(input: CreateArticleInput): Promise<{ pullNumber: number; branch: string; url: string }> {
  const headers = await authHeaders();
  const result = await request<{ success: boolean; data: { pullNumber: number; branch: string; filePath: string; url: string } }>('/api/create', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function updateArticle(id: number, input: UpdateArticleInput): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/articles/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });
}

export async function uploadImage(input: UploadImageInput): Promise<{ path: string }> {
  const headers = await authHeaders();
  const result = await request<{ success: boolean; data: { path: string } }>('/api/images', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function publishArticle(pullNumber: number): Promise<void> {
  const headers = await authHeaders();
  await request('/api/publish', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pullNumber }),
  });
}
