export interface Article {
  id: number;           // PR番号
  title: string;
  branch: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  markdownContent: string;  // Markdown本文
}

export interface CreateArticleInput {
  title: string;
  date: string;
  body: string;
  images: { filename: string; data: string }[];
}

export interface UpdateArticleInput {
  title: string;
  date: string;
  body: string;
  images: { filename: string; data: string; isNew: boolean }[];
}

export interface UploadImageInput {
  branch: string;
  date: string;
  filename: string;
  data: string;
}
