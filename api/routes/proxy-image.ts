import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";

const proxyImage = new Hono();

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

proxyImage.get("/", async (c) => {
  const path = c.req.query("path");
  const ref = c.req.query("ref") || "main";

  if (!path) {
    throw new HTTPException(400, {
      message: "pathパラメータが指定されていません",
    });
  }

  const normalizedPath = path.replace(/^\/+/, "");

  if (!normalizedPath.startsWith("assets/")) {
    throw new HTTPException(400, {
      message: "pathはassets/で始まる必要があります",
    });
  }

  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  let fileData;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: normalizedPath,
      ref,
    });
    fileData = data;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      throw new HTTPException(404, { message: "ファイルが見つかりません" });
    }
    throw error;
  }

  if (!("content" in fileData) || !fileData.content) {
    throw new HTTPException(404, { message: "ファイルが見つかりません" });
  }

  const binary = Buffer.from(fileData.content, "base64");

  // 拡張子からContent-Type判定
  const ext = normalizedPath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXTENSION_MIME[ext] || "application/octet-stream";

  return new Response(binary, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(binary.length),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});

export default proxyImage;
