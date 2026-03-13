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
import type { TreeEntry } from "../lib/git-tree";
import type { ArticleInput } from "../lib/types";
import crypto from "crypto";

export default async function createArticle(c: Context) {
  let body: ArticleInput;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, {
      message: "リクエストボディが空または不正なJSONです",
    });
  }
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
  const treeEntries: TreeEntry[] = [];

  // 画像のBlob作成
  for (let i = 0; i < imageArr.length; i++) {
    const img = imageArr[i];
    const seqName = getImageSequenceName(i);
    const imgPath = `${imageDir}/${seqName}`;
    imagePaths.push(`/${imgPath}`);

    const compressed = await compressImage(img.data);
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: compressed,
      encoding: "base64",
    });
    treeEntries.push({
      path: imgPath,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // サムネイル決定
  const thumbnailName = determineThumbnail(imagePaths.length, thumbnailIndex);

  // Markdown生成・Blob作成
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

  const { data: mdBlob } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(markdown).toString("base64"),
    encoding: "base64",
  });
  treeEntries.push({
    path: filePath,
    mode: "100644",
    type: "blob",
    sha: mdBlob.sha,
  });

  // ベースツリーSHAを取得
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: mainSha,
  });

  // Git Tree作成
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: commitData.tree.sha,
    tree: treeEntries,
  });

  // コミット作成
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `post: ${title}`,
    tree: newTree.sha,
    parents: [mainSha],
  });

  // ブランチref更新
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: newCommit.sha,
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
