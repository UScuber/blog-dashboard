import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "./lib/github";
import { verifyAuth } from "./lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const { branch, date, filename, data } = req.body as {
      branch: string;
      date: string;
      filename: string;
      data: string;
    };

    if (!branch || !date || !filename || !data) {
      return res.status(400).json({ error: "branch, date, filename, data are required" });
    }

    const imagePath = `assets/images/${date}/${filename}`;

    // 同名ファイルの SHA を取得（上書き用）
    let existingSha: string | undefined;
    try {
      const { data: existing } = await octokit.repos.getContent({
        owner,
        repo,
        path: imagePath,
        ref: branch,
      });
      if ("sha" in existing) {
        existingSha = existing.sha;
      }
    } catch {
      // ファイルが存在しない場合は新規作成
    }

    const { data: result } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: imagePath,
      message: `Add image: ${filename}`,
      content: data,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    return res.status(201).json({
      success: true,
      data: {
        path: `/assets/images/${date}/${filename}`,
        sha: result.content?.sha,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
