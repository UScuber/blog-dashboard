import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";
import { generateMarkdown } from "../lib/markdown";
import { validateArticleInput } from "../lib/validation";
import {
  compressImage,
  getImageSequenceName,
  determineThumbnail,
} from "../lib/image";
import { checkDuplicate } from "../lib/check-duplicate";
import type { ArticleInput } from "../lib/types";
import crypto from "crypto";

export default async function createArticle(c: Context) {
  const body: ArticleInput = await c.req.json();
  const {
    title,
    date,
    body: articleBody,
    images,
    categories,
    outline,
    thumbnailIndex,
  } = body;

  validateArticleInput(body);

  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  const filePath = `_posts/${date}-${title}.md`;

  // 重複チェック
  await checkDuplicate(octokit, owner, repo, filePath);

  // mainブランチの最新SHAを取得
  const { data: mainRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: "heads/main",
  });
  const mainSha = mainRef.object.sha;

  // ブランチを作成
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const branchName = `post/${date}-${randomSuffix}`;

  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainSha,
    });
  } catch (error) {
    if (error instanceof RequestError && error.status === 422) {
      throw new HTTPException(422, {
        message: "ブランチ名が既に存在します。もう一度お試しください",
      });
    }
    throw error;
  }

  const imageDir = `assets/img/blog/${date}-${title}`;
  const imageArr = images ?? [];
  const imagePaths: string[] = [];

  // 画像のコミット（1枚ずつ）
  for (let i = 0; i < imageArr.length; i++) {
    const img = imageArr[i];
    const seqName = getImageSequenceName(i);
    const imgPath = `${imageDir}/${seqName}`;
    imagePaths.push(`/${imgPath}`);

    const compressed = await compressImage(img.data);

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: imgPath,
      message: `add image: ${seqName}`,
      content: compressed,
      branch: branchName,
    });
  }

  // サムネイル決定
  const thumbnailName = determineThumbnail(imagePaths.length, thumbnailIndex);

  // Markdown生成・コミット
  const markdown = generateMarkdown({
    title,
    date,
    categories: categories ?? [],
    outline: outline ?? "",
    img: thumbnailName,
    thumb: thumbnailName,
    body: articleBody,
    images: imagePaths,
  });

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `post: ${title}`,
    content: Buffer.from(markdown).toString("base64"),
    branch: branchName,
  });

  // PR作成
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `post: ${title}`,
    head: branchName,
    base: "main",
  });

  return c.json(
    {
      success: true,
      data: {
        pullNumber: pr.number,
        branch: branchName,
        filePath,
        url: pr.html_url,
      },
    },
    201,
  );
}
