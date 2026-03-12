import type { ParsedArticle } from "./types";

let cacheBuster = Date.now();

export function resetCacheBuster() {
  cacheBuster = Date.now();
}

export function toProxyUrl(assetPath: string, branch?: string): string {
  const params = new URLSearchParams({ path: assetPath });
  if (branch) params.set("ref", branch);
  params.set("t", String(cacheBuster));
  return `/api/proxy-image?${params.toString()}`;
}

export function parseMarkdown(
  content: string,
  branch?: string
): ParsedArticle {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return {
      title: "",
      date: "",
      categories: [],
      outline: "",
      img: "",
      thumb: "",
      body: "",
      bodyHtml: "",
      existingImages: [],
    };
  }

  const frontmatter = fmMatch[1];
  const rawBody = fmMatch[2];

  const getString = (key: string): string => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
    return m ? m[1] : "";
  };

  const title = getString("title");
  const date = getString("date");
  const outline = getString("outline");
  const img = getString("img");
  const thumb = getString("thumb");

  const catMatch = frontmatter.match(/categories:\s*\n((?:\s*-\s*.+\n?)*)/);
  const categories: string[] = [];
  if (catMatch) {
    const lines = catMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*-\s*(.+)/);
      if (m) categories.push(m[1].trim());
    }
  }

  const existingImages: string[] = [];
  let imageIndex = 0;

  let bodyForHtml = rawBody.replace(/<br\s*\/?>/g, "");

  bodyForHtml = bodyForHtml.replace(
    /(<img\s[^>]*src=")([^"]*\/assets\/[^"]*?)("[^>]*>)/g,
    (_match, prefix, src, suffix) => {
      const proxyUrl = toProxyUrl(src, branch);
      return `${prefix}${proxyUrl}${suffix}`;
    }
  );

  bodyForHtml = bodyForHtml.replace(
    /(\/assets\/img\/[^\s"<>)]+)/g,
    (assetPath) => toProxyUrl(assetPath, branch)
  );

  const lines = bodyForHtml.split(/\n\n+/);
  const htmlParts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^<img\s/.test(trimmed) && trimmed.match(/<img/g)?.length === 1) {
      htmlParts.push(trimmed);
    } else if (trimmed.includes("<img")) {
      const parts = trimmed.split(/(<img\s[^>]*>)/);
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        if (p.startsWith("<img")) {
          htmlParts.push(p);
        } else {
          htmlParts.push(`<p>${p}</p>`);
        }
      }
    } else {
      htmlParts.push(`<p>${trimmed}</p>`);
    }
  }

  const bodyHtml = htmlParts.join("");

  let bodyText = rawBody;
  bodyText = bodyText.replace(/<img\s[^>]*src="([^"]*)"[^>]*>/g, (_match, src) => {
    existingImages.push(src);
    const placeholder = `[image:${imageIndex}]`;
    imageIndex++;
    return placeholder;
  });

  return {
    title,
    date,
    categories,
    outline,
    img,
    thumb,
    body: bodyText,
    bodyHtml,
    existingImages,
  };
}

export function htmlToBody(html: string): { body: string; imageSrcs: string[] } {
  const imageSrcs: string[] = [];
  let index = 0;

  let text = html.replace(/<img\s[^>]*src="([^"]*)"[^>]*>/g, (_match, src) => {
    imageSrcs.push(src);
    const placeholder = `[image:${index}]`;
    index++;
    return placeholder;
  });

  text = text.replace(/<\/p>\s*<p>/g, "\n\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return { body: text, imageSrcs };
}
