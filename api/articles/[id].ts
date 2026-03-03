import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "../lib/github";
import { verifyAuth } from "../lib/auth";
import { toJekyllMarkdown } from "../lib/markdown";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const pullNumber = Number(req.query.id);
    if (isNaN(pullNumber)) {
      return res.status(400).json({ error: "Invalid pull request number" });
    }

    const { title, date, body, images } = req.body as {
      title: string;
      date: string;
      body: string;
      images?: { filename: string; data: string; isNew?: boolean }[];
    };

    if (!title || !date || !body) {
      return res.status(400).json({ error: "title, date, body are required" });
    }

    // 1. PR からブランチ名を取得
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    const branchName = pr.head.ref;

    // 2. 新規画像をコミット
    const imagePaths: string[] = [];
    if (images && images.length > 0) {
      for (const image of images) {
        const imagePath = `assets/images/${date}/${image.filename}`;

        if (image.isNew) {
          // 同名ファイルの SHA を取得（上書き用）
          let existingSha: string | undefined;
          try {
            const { data: existing } = await octokit.repos.getContent({
              owner,
              repo,
              path: imagePath,
              ref: branchName,
            });
            if ("sha" in existing) {
              existingSha = existing.sha;
            }
          } catch {
            // ファイルが存在しない場合は新規作成
          }

          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: imagePath,
            message: `Update image: ${image.filename}`,
            content: image.data,
            branch: branchName,
            ...(existingSha ? { sha: existingSha } : {}),
          });
        }
        imagePaths.push(`/assets/images/${date}/${image.filename}`);
      }
    }

    // 3. 既存の _posts ファイルを特定し SHA を取得
    const { data: files } = await octokit.repos.getContent({
      owner,
      repo,
      path: "_posts",
      ref: branchName,
    });

    let existingFilePath = "";
    let existingFileSha = "";
    if (Array.isArray(files)) {
      const postFile = files.find((f) => f.name.endsWith(".md"));
      if (postFile && "sha" in postFile) {
        existingFilePath = postFile.path;
        existingFileSha = postFile.sha;
      }
    }

    if (!existingFilePath) {
      return res.status(404).json({ error: "Post file not found in branch" });
    }

    // 4. Markdown 再生成 & 更新コミット
    const markdown = toJekyllMarkdown({
      title,
      date,
      body,
      images: imagePaths,
    });

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: existingFilePath,
      message: `Update post: ${title}`,
      content: Buffer.from(markdown).toString("base64"),
      sha: existingFileSha,
      branch: branchName,
    });

    // 5. タイトル変更時は PR タイトルも更新
    if (pr.title !== `post: ${title}`) {
      await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        title: `post: ${title}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        pullNumber,
        branch: branchName,
        filePath: existingFilePath,
      },
    });
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Pull request or file not found" });
    }
    return res.status(500).json({ error: err.message });
  }
}
