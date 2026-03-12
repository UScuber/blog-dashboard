interface MarkdownParams {
  title: string;
  date: string;
  categories: string[];
  outline: string;
  img: string;
  thumb: string;
  body: string;
  images: string[];
}

export function generateMarkdown(params: MarkdownParams): string {
  const { title, date, categories, outline, img, thumb, body, images } = params;

  // Build front matter
  let frontMatter = `---\nlayout: post\ntitle: "${title}"\ndate: ${date}\n`;

  if (categories.length > 0) {
    frontMatter += "categories:\n";
    for (const cat of categories) {
      frontMatter += `- ${cat}\n`;
    }
  }

  if (img) {
    frontMatter += `img: ${img}\n`;
  }
  if (thumb) {
    frontMatter += `thumb: ${thumb}\n`;
  }
  if (outline) {
    frontMatter += `outline: ${outline}\n`;
  }

  frontMatter += "---";

  // Replace [image:N] placeholders
  let processedBody = body.replace(/\[image:(\d+)\]/g, (_, idx) => {
    const index = parseInt(idx, 10);
    if (index >= 0 && index < images.length) {
      return `<img src="${images[index]}" width="450px">`;
    }
    return "";
  });

  // Split by blank lines, remove empty paragraphs, rejoin
  const paragraphs = processedBody
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0);
  processedBody = paragraphs.join("\n\n");

  return `${frontMatter}\n\n${processedBody}\n`;
}
