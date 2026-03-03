import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "./lib/github";
import { verifyAuth } from "./lib/auth";
import { toJekyllMarkdown } from "./lib/markdown";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const { title, date, body, images } = req.body as {
      title: string;
      date: string;
      body: string;
      images?: { filename: string; data: string }[];
    };

    if (!title || !date || !body) {
      return res.status(400).json({ error: "title, date, body are required" });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const branchName = `post/${date}-${timestamp}`;

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

    // 3. 画像コミット
    const imagePaths: string[] = [];
    if (images && images.length > 0) {
      for (const image of images) {
        const imagePath = `assets/images/${date}/${image.filename}`;
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: imagePath,
          message: `Add image: ${image.filename}`,
          content: image.data, // Base64 エンコード済み
          branch: branchName,
        });
        imagePaths.push(`/assets/images/${date}/${image.filename}`);
      }
    }

    // 4. Markdown 生成 & コミット
    const markdown = toJekyllMarkdown({
      title,
      date,
      body,
      images: imagePaths,
    });

    const filePath = `_posts/${date}-${timestamp}.md`;
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Add post: ${title}`,
      content: Buffer.from(markdown).toString("base64"),
      branch: branchName,
    });

    // 5. PR 作成
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `post: ${title}`,
      head: branchName,
      base: "main",
      body: `New article: ${title}\nDate: ${date}`,
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
