export const CATEGORIES = [
  'ビーバー',
  'カブ',
  'ボーイ',
  'ベンチャー',
  '団活動',
  'お知らせ',
] as const;

export type Category = typeof CATEGORIES[number];

export interface Article {
  id: number;           // PR番号
  title: string;
  branch: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  markdownContent: string;  // Markdown本文
  previewStatus: string;          // "ready" | "building" | "pending"
  previewUrl: string | null;
}

export interface CreateArticleInput {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  thumbnailIndex: number;
  body: string;
  images: { filename: string; data: string }[];
}

export interface UpdateArticleInput {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  thumbnailIndex: number;
  body: string;
  images: { filename: string; data: string; isNew: boolean; originalPath?: string }[];
}

export interface UploadImageInput {
  branch: string;
  date: string;
  filename: string;
  data: string;
}
