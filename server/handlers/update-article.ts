import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";
import { generateMarkdown } from "../lib/markdown";
import { validateArticleInput } from "../lib/validation";
import { getImageSequenceName, determineThumbnail } from "../lib/image";
import { checkDuplicate } from "../lib/check-duplicate";
import { getTreeFiles, type TreeEntry } from "../lib/git-tree";
import { buildImageTreeEntries } from "../lib/image-tree";
import type { ArticleInput } from "../lib/types";

export default async function updateArticle(c: Context) {
  const id = parseInt(c.req.param("id") ?? "", 10);
  if (isNaN(id)) {
    throw new HTTPException(400, { message: "不正なPR番号です" });
  }

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

  // PR情報とファイル一覧を取得
  let pr;
  let prFiles;
  try {
    const [prRes, filesRes] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: id }),
      octokit.pulls.listFiles({ owner, repo, pull_number: id, per_page: 100 }),
    ]);
    pr = prRes.data;
    prFiles = filesRes.data;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      throw new HTTPException(404, { message: "PRが見つかりません" });
    }
    throw error;
  }

  const branch = pr.head.ref;
  const newFilePath = `_posts/${date}-${title}.md`;

  // 既存のmdファイルを特定
  const existingMdFile = prFiles.find(
    (f) => f.filename.startsWith("_posts/") && f.filename.endsWith(".md"),
  );
  const oldFilePath = existingMdFile?.filename;
  const filePathChanged = oldFilePath !== newFilePath;

  // 重複チェック（日付・タイトルが変わった場合のみ）
  if (filePathChanged) {
    await checkDuplicate(octokit, owner, repo, newFilePath, id);
  }

  // ブランチの最新コミットSHA・ツリーSHAを取得
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const latestCommitSha = refData.object.sha;

  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = commitData.tree.sha;

  // ツリーを再帰展開してフルマップ構築
  const existingFiles = await getTreeFiles(octokit, owner, repo, baseTreeSha);

  // 画像ディレクトリの決定
  const newImageDir = `assets/img/blog/${date}-${title}`;

  // 旧画像ディレクトリの特定
  let oldImageDir: string | null = null;
  if (existingMdFile) {
    const oldName = existingMdFile.filename
      .replace("_posts/", "")
      .replace(".md", "");
    oldImageDir = `assets/img/blog/${oldName}`;
  }
  const imageDirChanged = oldImageDir !== null && oldImageDir !== newImageDir;

  const imageArr = images ?? [];

  // 画像ツリーエントリの構築
  const treeEntries: TreeEntry[] = await buildImageTreeEntries({
    images: imageArr,
    newImageDir,
    oldImageDir,
    imageDirChanged,
    existingFiles,
    octokit,
    owner,
    repo,
  });

  // 画像パス配列の構築
  const imagePaths = imageArr.map((_: unknown, i: number) => {
    return `/${newImageDir}/${getImageSequenceName(i)}`;
  });

  // サムネイル決定
  const thumbnailName = determineThumbnail(imagePaths.length, thumbnailIndex);

  // Markdown生成
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

  // Markdown Blob作成
  const { data: mdBlob } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(markdown).toString("base64"),
    encoding: "base64",
  });

  treeEntries.push({
    path: newFilePath,
    mode: "100644",
    type: "blob",
    sha: mdBlob.sha,
  });

  // 旧mdファイルの削除エントリ
  if (filePathChanged && oldFilePath) {
    treeEntries.push({
      path: oldFilePath,
      mode: "100644",
      type: "blob",
      sha: null,
    });
  }

  // Git Tree作成
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeEntries as TreeEntry[],
  });

  // コミット作成
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `update: ${title}`,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // ブランチref更新
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  // PRタイトル更新
  if (filePathChanged) {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: id,
      title: `post: ${title}`,
    });
  }

  return c.json({
    success: true,
    data: {
      pullNumber: id,
      branch,
      filePath: newFilePath,
    },
  });
}
