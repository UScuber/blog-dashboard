export interface ParsedArticle {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  img: string;
  thumb: string;
  body: string; // [image:N] プレースホルダー入りのテキスト
  bodyHtml: string; // WYSIWYG エディタ用 HTML
  existingImages: string[]; // 既存の画像パス配列
}

export function parseMarkdown(content: string, branch?: string): ParsedArticle {
  let title = "";
  let date = "";
  let categories: string[] = [];
  let outline = "";
  let img = "";
  let thumb = "";
  let body = "";
  const existingImages: string[] = [];

  // Front Matter を抽出
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontMatter = fmMatch[1];
    body = fmMatch[2];

    // title を抽出 (引用符あり・なし両対応)
    const titleMatch = frontMatter.match(/title:\s*"(.+?)"/);
    if (titleMatch) {
      title = titleMatch[1];
    } else {
      const titleMatchNoQuote = frontMatter.match(/title:\s*(.+)/);
      if (titleMatchNoQuote) {
        title = titleMatchNoQuote[1].trim();
      }
    }

    // date を抽出
    const dateMatch = frontMatter.match(/date:\s*(\S+)/);
    if (dateMatch) {
      date = dateMatch[1];
    }

    // categories を抽出 (YAML配列形式)
    const catMatch = frontMatter.match(/categories:\n((?:- .+\n?)+)/);
    if (catMatch) {
      categories = catMatch[1]
        .split("\n")
        .map((line) => line.replace(/^- /, "").trim())
        .filter((c) => c.length > 0);
    }

    // img を抽出
    const imgMatch = frontMatter.match(/img:\s*(.+)/);
    if (imgMatch) {
      img = imgMatch[1].trim();
    }

    // thumb を抽出
    const thumbMatch = frontMatter.match(/thumb:\s*(.+)/);
    if (thumbMatch) {
      thumb = thumbMatch[1].trim();
    }

    // outline を抽出
    const outlineMatch = frontMatter.match(/outline:\s*(.+)/);
    if (outlineMatch) {
      outline = outlineMatch[1].trim();
    }
  } else {
    body = content;
  }

  // bodyHtml: WYSIWYG エディタ用の HTML を生成
  // <img> タグはそのまま維持し、テキストを <p> タグで囲む
  const bodyHtml = bodyToHtml(body, branch);

  // body テキスト変換: <img> を [image:N] に置換
  // 属性付き <img> にも対応 (width, alt 等)
  body = body.replace(/<img\s+src="([^"]+)"[^>]*>/g, (_, src) => {
    const index = existingImages.length;
    existingImages.push(src);
    return `[image:${index}]`;
  });

  // <br> タグを除去
  body = body.replace(/<br>/g, "");

  // 連続改行を正規化（3つ以上の改行を2つに）
  body = body.replace(/\n{3,}/g, "\n\n");

  // 先頭・末尾の空白を除去
  body = body.trim();

  return {
    title,
    date,
    categories,
    outline,
    img,
    thumb,
    body,
    bodyHtml,
    existingImages,
  };
}

/** /assets/... パスをプロキシ API 経由の URL に変換 */
export function toProxyUrl(assetPath: string, branch?: string): string {
  // 先頭の / を除去して API パスに変換
  const cleanPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  let url = `/api/proxy-image?path=${encodeURIComponent(cleanPath)}`;
  if (branch) {
    url += `&ref=${encodeURIComponent(branch)}`;
  }
  return url;
}

/** Markdown 本文を WYSIWYG エディタ用の HTML に変換 */
function bodyToHtml(body: string, branch?: string): string {
  // <br> タグを除去
  let html = body.replace(/<br\s*\/?>/g, "");

  // /assets/... パスをプロキシ URL に変換
  html = html.replace(
    /<img\s+src="(\/assets\/[^"]+)"([^>]*)>/g,
    (_, src, rest) => {
      return `<img src="${toProxyUrl(src, branch)}"${rest}>`;
    },
  );

  // 段落に分割（空行区切り）
  const paragraphs = html
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs
    .map((p) => {
      // <img> タグのみの段落はそのまま返す
      if (/^(<img\s[^>]+>)+$/.test(p.trim())) {
        return p.trim();
      }
      // テキスト内に <img> がある場合は分割して処理
      if (/<img\s/.test(p)) {
        const parts = p.split(/(<img\s[^>]+>)/);
        return parts
          .map((part) => {
            if (/^<img\s/.test(part)) return part;
            const text = part.trim();
            if (!text) return "";
            return `<p>${text}</p>`;
          })
          .filter(Boolean)
          .join("");
      }
      return `<p>${p}</p>`;
    })
    .join("");
}

/** WYSIWYG エディタの HTML を [image:N] プレースホルダー付きテキストに変換 */
export function htmlToBody(html: string): {
  body: string;
  imageSrcs: string[];
} {
  const imageSrcs: string[] = [];

  // img タグを [image:N] に置換
  let text = html.replace(/<img\s+src="([^"]+)"[^>]*\/?>/g, (_, src) => {
    const index = imageSrcs.length;
    imageSrcs.push(src);
    return `[image:${index}]`;
  });

  // HTML タグを処理
  text = text.replace(/<\/p>\s*<p>/g, "\n\n"); // 段落区切り → 改行
  text = text.replace(/<p>/g, "");
  text = text.replace(/<\/p>/g, "");
  text = text.replace(/<br\s*\/?>/g, "\n");

  // 連続改行を正規化
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return { body: text, imageSrcs };
}
