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

    const { pullNumber } = req.body as { pullNumber: number };

    if (!pullNumber) {
      return res.status(400).json({ error: "pullNumber is required" });
    }

    // 1. PR 状態確認
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    if (pr.state !== "open") {
      return res.status(400).json({ error: "Pull request is not open" });
    }

    if (pr.mergeable === false) {
      return res.status(400).json({ error: "Pull request has merge conflicts" });
    }

    // 2. Squash マージ
    const { data: mergeResult } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: "squash",
    });

    // 3. ブランチ削除
    try {
      await octokit.git.deleteRef({
        owner,
        repo,
        ref: `heads/${pr.head.ref}`,
      });
    } catch {
      // ブランチ削除失敗は無視（マージ自体は成功）
    }

    return res.status(200).json({
      success: true,
      data: {
        merged: mergeResult.merged,
        message: mergeResult.message,
        sha: mergeResult.sha,
      },
    });
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Pull request not found" });
    }
    if (err.status === 405) {
      return res.status(405).json({ error: "Pull request is not mergeable" });
    }
    return res.status(500).json({ error: err.message });
  }
}
