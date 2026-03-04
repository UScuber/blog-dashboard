import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "../lib/github";
import { verifyAuth } from "../lib/auth";

interface VercelDeployment {
  url: string;
  state: string;
  meta?: {
    githubCommitRef?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const id = Number(req.query.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid PR id" });
    }

    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (!vercelToken || !vercelProjectId) {
      return res.status(500).json({ error: "VERCEL_TOKEN or VERCEL_PROJECT_ID is not set" });
    }

    // PR からブランチ名を取得
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: id,
    });
    const branch = pr.head.ref;

    // Vercel API でデプロイ一覧を取得
    const vercelRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=30`,
      { headers: { Authorization: `Bearer ${vercelToken}` } },
    );

    if (!vercelRes.ok) {
      const body = await vercelRes.text();
      return res.status(502).json({ error: `Vercel API error: ${body}` });
    }

    const { deployments } = (await vercelRes.json()) as { deployments: VercelDeployment[] };

    // ブランチが一致する最新のデプロイを探す
    const ready = deployments.find(
      (d) => d.meta?.githubCommitRef === branch && d.state === "READY",
    );
    if (ready) {
      return res.status(200).json({
        success: true,
        data: { status: "ready", previewUrl: `https://${ready.url}` },
      });
    }

    const building = deployments.find(
      (d) => d.meta?.githubCommitRef === branch && (d.state === "BUILDING" || d.state === "QUEUED" || d.state === "INITIALIZING"),
    );
    if (building) {
      return res.status(200).json({
        success: true,
        data: { status: "building", previewUrl: null },
      });
    }

    return res.status(200).json({
      success: true,
      data: { status: "pending", previewUrl: null },
    });
  } catch (err: any) {
    if (err.message === "Authorization header missing" || err.message === "Forbidden: email not allowed") {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}
