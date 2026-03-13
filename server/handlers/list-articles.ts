import type { Context } from "hono";
import { getOctokit, getRepoInfo } from "../lib/github";

export default async function listArticles(c: Context) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  const filtered = pulls
    .filter((pr) => pr.head.ref.startsWith("post/"))
    .map((pr) => ({
      id: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      status: pr.state,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));

  return c.json({ success: true, data: filtered });
}
