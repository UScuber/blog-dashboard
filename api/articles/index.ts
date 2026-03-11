import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "../lib/github";
import { verifyAuth } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    // PR一覧とVercelデプロイ一覧を並列取得
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_BLOG_PROJECT_ID;

    const [{ data: pulls }, deployments] = await Promise.all([
      octokit.pulls.list({
        owner,
        repo,
        state: "open",
        sort: "updated",
        direction: "desc",
      }),
      (vercelToken && vercelProjectId)
        ? fetch(
            `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=30`,
            { headers: { Authorization: `Bearer ${vercelToken}` } },
          ).then(async (r) => {
            if (!r.ok) return [];
            const { deployments } = await r.json() as { deployments: { url: string; state: string; meta?: { githubCommitRef?: string } }[] };
            return deployments;
          })
        : Promise.resolve([]),
    ]);

    // post/ ブランチのみフィルタ
    const postPulls = pulls.filter((pr: any) =>
      pr.head.ref.startsWith("post/"),
    );

    const articles = await Promise.all(
      postPulls.map(async (pr: any) => {
        let markdownContent = "";

        try {
          const { data: prFiles } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: pr.number,
          });

          const postFile = prFiles.find(
            (f) => f.filename.startsWith("_posts/") && f.filename.endsWith(".md")
          );

          if (postFile) {
            const { data: fileData } = await octokit.repos.getContent({
              owner,
              repo,
              path: postFile.filename,
              ref: pr.head.ref,
            });

            if ("content" in fileData && fileData.content) {
              markdownContent = Buffer.from(
                fileData.content,
                "base64",
              ).toString("utf-8");
            }
          }
        } catch {
          // ファイルが見つからない場合は空のまま
        }

        // デプロイ状況をマッチング
        const branch = pr.head.ref;
        const building = deployments.find(
          (d) => d.meta?.githubCommitRef === branch && (d.state === "BUILDING" || d.state === "QUEUED" || d.state === "INITIALIZING"),
        );
        const ready = deployments.find(
          (d) => d.meta?.githubCommitRef === branch && d.state === "READY",
        );

        let previewStatus = "pending";
        let previewUrl: string | null = null;
        if (building) {
          previewStatus = "building";
        } else if (ready) {
          previewStatus = "ready";
          previewUrl = `https://${ready.url}`;
        }

        return {
          id: pr.number,
          title: pr.title,
          branch,
          status: pr.state,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          markdownContent,
          previewStatus,
          previewUrl,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: articles,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
