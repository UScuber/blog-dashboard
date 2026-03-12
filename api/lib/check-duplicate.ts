import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit } from "./github";

async function fileExistsOnBranch(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<boolean> {
  try {
    await octokit.repos.getContent({ owner, repo, path, ref });
    return true;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function checkDuplicate(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  filePath: string,
  excludePrNumber?: number,
) {
  // mainブランチでの確認
  if (await fileExistsOnBranch(octokit, owner, repo, filePath, "main")) {
    throw new HTTPException(409, {
      message: "同じ日付・タイトルの記事が既に存在します",
    });
  }

  // オープンPRでの確認
  const { data: prs } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  const postPrs = prs.filter(
    (pr) =>
      pr.head.ref.startsWith("post/") &&
      (excludePrNumber === undefined || pr.number !== excludePrNumber),
  );

  for (const pr of postPrs) {
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    });

    if (files.some((f) => f.filename === filePath)) {
      throw new HTTPException(409, {
        message: "同じ日付・タイトルの記事が既に存在します",
      });
    }
  }
}
