import type { Context } from "hono";

export default async function getDeployments(c: Context) {
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_BLOG_PROJECT_ID;

  if (!vercelToken || !projectId) {
    return c.json({ success: true, data: {} });
  }

  const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${vercelToken}`,
    },
  });

  if (!response.ok) {
    return c.json({ success: true, data: {} });
  }

  const result = (await response.json()) as {
    deployments: Array<{
      state?: string;
      url?: string;
      meta?: { githubCommitRef?: string };
    }>;
  };

  const branchMap: Record<
    string,
    { previewStatus: string; previewUrl: string | null }
  > = {};

  for (const deploy of result.deployments) {
    const branch = deploy.meta?.githubCommitRef;
    if (!branch) continue;

    // 最初に見つかったデプロイ（最新）を採用
    if (branchMap[branch]) continue;

    const state = deploy.state;

    if (
      state === "BUILDING" ||
      state === "QUEUED" ||
      state === "INITIALIZING"
    ) {
      branchMap[branch] = { previewStatus: "building", previewUrl: null };
    } else if (state === "READY") {
      branchMap[branch] = {
        previewStatus: "ready",
        previewUrl: deploy.url ? `https://${deploy.url}` : null,
      };
    } else {
      branchMap[branch] = { previewStatus: "pending", previewUrl: null };
    }
  }

  return c.json({ success: true, data: branchMap });
}
