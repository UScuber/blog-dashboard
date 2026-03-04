export interface ArticleInput {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  img: string;       // サムネイル画像ファイル名 (例: image001.jpg)
  thumb: string;     // サムネイル画像ファイル名 (例: image001.jpg)
  body: string;
  images: string[];  // フルパス配列
}

export function toJekyllMarkdown(input: ArticleInput): string {
  const { title, date, categories, outline, img, thumb, body, images } = input;

  // Front Matter
  const lines = [
    "---",
    "layout: post",
    `title: "${title}"`,
    `date: ${date}`,
  ];

  if (categories.length > 0) {
    lines.push("categories:");
    for (const cat of categories) {
      lines.push(`- ${cat}`);
    }
  }

  if (img) {
    lines.push(`img: ${img}`);
  }
  if (thumb) {
    lines.push(`thumb: ${thumb}`);
  }
  if (outline) {
    lines.push(`outline: ${outline}`);
  }

  lines.push("---");
  const frontMatter = lines.join("\n");

  // 本文変換
  let content = body;

  // [image:N] プレースホルダーを <img> タグに置換
  content = content.replace(/\[image:(\d+)\]/g, (_, index) => {
    const i = parseInt(index, 10);
    if (i >= 0 && i < images.length) {
      return `\n<img src="${images[i]}" width="450px">`;
    }
    return "";
  });

  // 連続する空行を段落区切りとして整形
  content = content
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n");

  return `${frontMatter}\n\n${content}\n`;
}
