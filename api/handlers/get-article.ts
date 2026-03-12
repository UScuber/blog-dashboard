import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";

export default async function getArticle(c: Context) {
  const id = parseInt(c.req.param("id") ?? "", 10);
  if (isNaN(id)) {
    throw new HTTPException(400, { message: "不正なPR番号です" });
  }

  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  let pr;
  try {
    const [prRes, filesRes] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: id }),
      octokit.pulls.listFiles({ owner, repo, pull_number: id, per_page: 100 }),
    ]);
    pr = prRes.data;

    const mdFile = filesRes.data.find(
      (f) => f.filename.startsWith("_posts/") && f.filename.endsWith(".md"),
    );

    let markdownContent = "";
    if (mdFile) {
      const { data: fileContent } = await octokit.repos.getContent({
        owner,
        repo,
        path: mdFile.filename,
        ref: pr.head.ref,
      });

      if ("content" in fileContent && fileContent.content) {
        markdownContent = Buffer.from(fileContent.content, "base64").toString(
          "utf-8",
        );
      }
    }

    return c.json({
      success: true,
      data: {
        id: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        status: pr.state,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        markdownContent,
      },
    });
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      throw new HTTPException(404, { message: "記事が見つかりません" });
    }
    throw error;
  }
}
