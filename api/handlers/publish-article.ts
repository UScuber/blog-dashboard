import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";

export default async function publishArticle(c: Context) {
  const body = await c.req.json();
  const { pullNumber } = body;

  if (!pullNumber) {
    throw new HTTPException(400, { message: "PR番号が指定されていません" });
  }

  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  // PR状態確認
  let pr;
  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    pr = data;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      throw new HTTPException(404, { message: "PRが見つかりません" });
    }
    throw error;
  }

  if (pr.state !== "open") {
    throw new HTTPException(400, {
      message: "PRがオープン状態ではありません",
    });
  }

  if (pr.mergeable === false) {
    throw new HTTPException(400, {
      message: "マージコンフリクトがあります。解決してから再度お試しください",
    });
  }

  // Squashマージ実行
  let mergeResult;
  try {
    const { data } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: "squash",
    });
    mergeResult = data;
  } catch (error) {
    if (error instanceof RequestError && error.status === 405) {
      throw new HTTPException(405, {
        message: "PRをマージできません",
      });
    }
    throw error;
  }

  // ブランチ削除（失敗しても無視）
  try {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${pr.head.ref}`,
    });
  } catch {
    // ignore
  }

  return c.json({
    success: true,
    data: {
      merged: mergeResult.merged,
      message: mergeResult.message,
      sha: mergeResult.sha,
    },
  });
}
