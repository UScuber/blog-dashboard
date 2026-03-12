export const CATEGORIES = [
  "ビーバー",
  "カブ",
  "ボーイ",
  "ベンチャー",
  "団活動",
  "お知らせ",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ArticleSummary {
  id: number;
  title: string;
  branch: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Article extends ArticleSummary {
  markdownContent: string;
}

export interface DeploymentInfo {
  previewStatus: string;
  previewUrl: string | null;
}

export type DeploymentMap = Record<string, DeploymentInfo>;

export interface ImageItem {
  src: string;
  data: string;
  isNew: boolean;
  originalPath: string;
  filename: string;
}

export interface CreateArticleInput {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  body: string;
  images: { filename: string; data: string }[];
  thumbnailIndex: number;
}

export interface UpdateArticleInput {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  body: string;
  images: {
    filename: string;
    data: string;
    isNew: boolean;
    originalPath: string;
  }[];
  thumbnailIndex: number;
}

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  content: string;
  image: ImageItem;
}

export type Block = TextBlock | ImageBlock;

export interface ParsedArticle {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  img: string;
  thumb: string;
  body: string;
  bodyHtml: string;
  existingImages: string[];
}
