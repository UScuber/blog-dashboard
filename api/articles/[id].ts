import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "../lib/github";
import { verifyAuth } from "../lib/auth";
import { toJekyllMarkdown } from "../lib/markdown";

/** 画像のインデックスから連番ファイル名を生成 */
function toSequentialFilename(index: number, originalFilename: string): string {
  const ext = originalFilename.includes(".")
    ? originalFilename.substring(originalFilename.lastIndexOf("."))
    : ".jpg";
  return `image${String(index + 1).padStart(3, "0")}${ext}`;
}

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

    const { title, date, body, images, categories, outline, thumbnailIndex } = req.body as {
      title: string;
      date: string;
      body: string;
      images?: { filename: string; data: string; isNew?: boolean }[];
      categories?: string[];
      outline?: string;
      thumbnailIndex?: number;
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

    // 2. PRの変更ファイル一覧を取得 (pulls.listFiles)
    const { data: prFiles } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });

    // 3. 画像ディレクトリ名を決定
    const postSlug = `${date}-${title}`;
    const imageDir = `assets/img/blog/${postSlug}`;

    // 4. 新規画像をコミット
    const imagePaths: string[] = [];
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const seqFilename = toSequentialFilename(i, images[i].filename);
        const imagePath = `${imageDir}/${seqFilename}`;

        if (images[i].isNew) {
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
            message: `Update image: ${seqFilename}`,
            content: images[i].data,
            branch: branchName,
            ...(existingSha ? { sha: existingSha } : {}),
          });
        }
        imagePaths.push(`/${imagePath}`);
      }
    }

    // 5. PRの変更ファイルから既存の_postsファイルを特定
    const postFile = prFiles.find(
      (f) => f.filename.startsWith("_posts/") && f.filename.endsWith(".md")
    );

    let existingFilePath = "";
    let existingFileSha = "";

    if (postFile) {
      existingFilePath = postFile.filename;
      // SHA を取得
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: existingFilePath,
          ref: branchName,
        });
        if ("sha" in fileData) {
          existingFileSha = fileData.sha;
        }
      } catch {
        // ファイルが見つからない場合
      }
    }

    if (!existingFilePath || !existingFileSha) {
      return res.status(404).json({ error: "Post file not found in PR changes" });
    }

    // 6. サムネイル画像名の決定
    const thumbIdx = typeof thumbnailIndex === "number" && thumbnailIndex >= 0 && images && thumbnailIndex < images.length
      ? thumbnailIndex
      : 0;
    const imgFilename = images && images.length > 0
      ? toSequentialFilename(thumbIdx, images[thumbIdx].filename)
      : "";
    const thumbFilename = imgFilename;

    // 7. Markdown 再生成 & 更新コミット
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

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: existingFilePath,
      message: `Update post: ${title}`,
      content: Buffer.from(markdown).toString("base64"),
      sha: existingFileSha,
      branch: branchName,
    });

    // 8. タイトル変更時は PR タイトルも更新
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
