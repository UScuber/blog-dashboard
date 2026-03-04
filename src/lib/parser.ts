export interface ParsedArticle {
  title: string;
  date: string;
  body: string;           // [image:N] プレースホルダー入りのテキスト
  existingImages: string[]; // 既存の画像パス配列
}

export function parseMarkdown(content: string): ParsedArticle {
  let title = '';
  let date = '';
  let body = '';
  const existingImages: string[] = [];

  // Front Matter を抽出
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontMatter = fmMatch[1];
    body = fmMatch[2];

    // title を抽出
    const titleMatch = frontMatter.match(/title:\s*"(.+?)"/);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // date を抽出
    const dateMatch = frontMatter.match(/date:\s*(\S+)/);
    if (dateMatch) {
      date = dateMatch[1];
    }
  } else {
    body = content;
  }

  // <img src="..."> を見つけて画像パスを配列に格納し、[image:N] に置換
  body = body.replace(/<img\s+src="([^"]+)">/g, (_, src) => {
    const index = existingImages.length;
    existingImages.push(src);
    return `[image:${index}]`;
  });

  // <br> タグを除去
  body = body.replace(/<br>/g, '');

  // 連続改行を正規化（3つ以上の改行を2つに）
  body = body.replace(/\n{3,}/g, '\n\n');

  // 先頭・末尾の空白を除去
  body = body.trim();

  return { title, date, body, existingImages };
}
