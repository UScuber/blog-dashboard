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

    // open な PR 一覧を取得
    const { data: pulls } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      sort: "updated",
      direction: "desc",
    });

    // post/ ブランチのみフィルタ
    const postPulls = pulls.filter((pr: any) =>
      pr.head.ref.startsWith("post/"),
    );

    const articles = await Promise.all(
      postPulls.map(async (pr: any) => {
        let markdownContent = "";

        try {
          // PR ブランチの _posts/ ディレクトリ内容を取得
          const { data: files } = await octokit.repos.getContent({
            owner,
            repo,
            path: "_posts",
            ref: pr.head.ref,
          });

          if (Array.isArray(files)) {
            // ブランチ固有のファイルを見つける
            const postFile = files.find((f) => f.name.endsWith(".md"));
            if (postFile && postFile.type === "file") {
              const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: postFile.path,
                ref: pr.head.ref,
              });

              if ("content" in fileData && fileData.content) {
                markdownContent = Buffer.from(
                  fileData.content,
                  "base64",
                ).toString("utf-8");
              }
            }
          }
        } catch {
          // _posts が無い場合は空のまま
        }

        return {
          id: pr.number,
          title: pr.title,
          branch: pr.head.ref,
          status: pr.state,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          markdownContent,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: articles,
      _debug: {
        repo: `${owner}/${repo}`,
        totalPulls: pulls.length,
        pullBranches: pulls.map((pr: any) => pr.head.ref),
        postPullsCount: postPulls.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
