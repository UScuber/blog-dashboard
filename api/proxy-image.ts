import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "./lib/github";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { path: filePath, ref } = req.query as { path?: string; ref?: string };

    if (!filePath) {
      return res.status(400).json({ error: "path query parameter is required" });
    }

    // パスの安全性チェック: assets/ で始まるもののみ許可
    if (!filePath.startsWith("assets/")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const targetRef = ref || "main";

    // base64形式で取得してデコード
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: targetRef,
    });

    if (!("content" in fileData) || !fileData.content) {
      return res.status(404).json({ error: "Image not found" });
    }

    const buffer = Buffer.from(fileData.content, "base64");

    // Content-Type を拡張子から判定
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length.toString());

    return res.status(200).send(buffer);
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Image not found" });
    }
    return res.status(500).json({ error: err.message });
  }
}
