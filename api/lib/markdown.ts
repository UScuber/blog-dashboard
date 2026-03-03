export interface ArticleInput {
  title: string;
  date: string;
  body: string;
  images: string[];
}

export function toJekyllMarkdown(input: ArticleInput): string {
  const { title, date, body, images } = input;

  // Front Matter
  const frontMatter = [
    "---",
    "layout: post",
    `title: "${title}"`,
    `date: ${date}`,
    "---",
  ].join("\n");

  // 本文変換
  let content = body;

  // [image:N] プレースホルダーを <img> タグに置換
  content = content.replace(/\[image:(\d+)\]/g, (_, index) => {
    const i = parseInt(index, 10);
    if (i >= 0 && i < images.length) {
      return `\n<br>\n\n<img src="${images[i]}">\n\n<br>`;
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
