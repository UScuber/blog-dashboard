export interface ArticleInput {
  title: string;
  date: string;
  body: string;
  images?: ImageInput[];
  categories?: string[];
  outline?: string;
  thumbnailIndex?: number;
}

export interface ImageInput {
  data: string;
  isNew: boolean;
  originalPath?: string;
}
