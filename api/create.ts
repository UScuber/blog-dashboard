import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "./lib/github";
import { verifyAuth } from "./lib/auth";
import { toJekyllMarkdown } from "./lib/markdown";

/** 画像のインデックスから連番ファイル名を生成 (image001.jpg, image002.jpg, ...) */
function toSequentialFilename(index: number, originalFilename: string): string {
  const ext = originalFilename.includes(".")
    ? originalFilename.substring(originalFilename.lastIndexOf("."))
    : ".jpg";
  return `image${String(index + 1).padStart(3, "0")}${ext}`;
}

/** ランダムな英数字8桁のIDを生成 */
function generateRandomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const { title, date, body, images, categories, outline, thumbnailIndex } = req.body as {
      title: string;
      date: string;
      body: string;
      images?: { filename: string; data: string }[];
      categories?: string[];
      outline?: string;
      thumbnailIndex?: number;
    };

    if (!title || !date || !body) {
      return res.status(400).json({ error: "title, date, body are required" });
    }

    // ファイル・画像ディレクトリ用のスラグ
    const postSlug = `${date}-${title}`;
    // ブランチ名はASCIIのみ (yyyy-mm-dd-ランダム8桁)
    const branchName = `post/${date}-${generateRandomId()}`;

    // 1. main の最新 SHA を取得
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: "heads/main",
    });
    const mainSha = refData.object.sha;

    // 2. ブランチ作成
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainSha,
    });

    // 3. 画像コミット (連番ファイル名に変換)
    const imagePaths: string[] = [];
    const imageDir = `assets/img/blog/${postSlug}`;

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const seqFilename = toSequentialFilename(i, images[i].filename);
        const imagePath = `${imageDir}/${seqFilename}`;
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: imagePath,
          message: `Add image: ${seqFilename}`,
          content: images[i].data,
          branch: branchName,
        });
        imagePaths.push(`/${imagePath}`);
      }
    }

    // 4. サムネイル画像名の決定
    const thumbIdx = typeof thumbnailIndex === "number" && thumbnailIndex >= 0 && images && thumbnailIndex < images.length
      ? thumbnailIndex
      : 0;
    const imgFilename = images && images.length > 0
      ? toSequentialFilename(thumbIdx, images[thumbIdx].filename)
      : "";
    const thumbFilename = imgFilename;

    // 5. Markdown 生成 & コミット
    const markdown = toJekyllMarkdown({
      title,
      date,
      categories: categories || [],
      outline: outline || "",
      img: imgFilename,
      thumb: thumbFilename,
      body,
      images: imagePaths,
    });

    const filePath = `_posts/${postSlug}.md`;
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Add post: ${title}`,
      content: Buffer.from(markdown).toString("base64"),
      branch: branchName,
    });

    // 6. PR 作成
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `post: ${title}`,
      head: branchName,
      base: "main",
      body: `New article: ${title}\nDate: ${date}\nCategories: ${(categories || []).join(", ")}`,
    });

    return res.status(201).json({
      success: true,
      data: {
        pullNumber: pr.number,
        branch: branchName,
        filePath,
        url: pr.html_url,
      },
    });
  } catch (err: any) {
    if (err.status === 422) {
      return res.status(422).json({ error: "Branch already exists or validation failed" });
    }
    return res.status(500).json({ error: err.message });
  }
}
