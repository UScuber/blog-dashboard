import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { getOctokit, getRepoInfo } from "../lib/github";
import { generateMarkdown } from "../lib/markdown";
import { validateTitle } from "../lib/validation";
import { compressImage } from "../lib/image";

const articles = new Hono();

// 記事一覧取得
articles.get("/", async (c) => {
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
});

// 記事詳細取得
articles.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
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
});

// 記事更新
articles.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HTTPException(400, { message: "不正なPR番号です" });
  }

  const body = await c.req.json();
  const {
    title,
    date,
    body: articleBody,
    images,
    categories,
    outline,
    thumbnailIndex,
  } = body;

  if (!title || !date || articleBody === undefined) {
    throw new HTTPException(400, {
      message: "タイトル、日付、本文は必須です",
    });
  }

  const titleValidation = validateTitle(title);
  if (!titleValidation.valid) {
    throw new HTTPException(400, { message: titleValidation.error });
  }

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

  const treeEntries: TreeEntry[] = [];
  const imageArr = images ?? [];

  if (imageArr.length > 0) {
    // 画像のツリーエントリ構築
    for (let i = 0; i < imageArr.length; i++) {
      const img = imageArr[i];
      const seqName = `image${String(i + 1).padStart(3, "0")}.jpg`;
      const newPath = `${newImageDir}/${seqName}`;

      if (img.isNew) {
        // 新規画像: 圧縮してBlob作成
        const compressed = await compressImage(img.data);
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: compressed,
          encoding: "base64",
        });
        treeEntries.push({
          path: newPath,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      } else {
        // 既存画像
        if (!img.originalPath) {
          throw new HTTPException(400, {
            message: `既存画像のoriginalPathが未設定です（index: ${i}）`,
          });
        }

        const existingBlob = existingFiles.get(img.originalPath);
        if (!existingBlob) {
          throw new HTTPException(400, {
            message: `既存画像ファイルが見つかりません: ${img.originalPath}`,
          });
        }

        if (img.originalPath !== newPath) {
          // パスが変わる場合: 新パスにBlob SHAを再利用
          treeEntries.push({
            path: newPath,
            mode: "100644",
            type: "blob",
            sha: existingBlob,
          });
        }
        // パス変更なし: ベースツリーから引き継ぐのでエントリ不要
      }
    }

    // 不要画像の削除エントリ
    if (imageDirChanged && oldImageDir) {
      // ディレクトリ変更時: 旧ディレクトリの全ファイルを削除
      for (const [path] of existingFiles) {
        if (path.startsWith(oldImageDir + "/")) {
          treeEntries.push({
            path,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
      }
    } else {
      // 同一ディレクトリ: 最終連番に含まれないファイルを削除
      const finalNames = new Set<string>();
      for (let i = 0; i < imageArr.length; i++) {
        finalNames.add(
          `${newImageDir}/image${String(i + 1).padStart(3, "0")}.jpg`,
        );
      }
      const dirPrefix = newImageDir + "/";
      for (const [path] of existingFiles) {
        if (path.startsWith(dirPrefix) && !finalNames.has(path)) {
          treeEntries.push({
            path,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
      }
    }
  } else {
    // 画像が全削除された場合: 既存の全画像ファイルに削除エントリ
    const dirs = new Set<string>();
    if (oldImageDir) dirs.add(oldImageDir + "/");
    if (newImageDir) dirs.add(newImageDir + "/");

    for (const [path] of existingFiles) {
      for (const dir of dirs) {
        if (path.startsWith(dir)) {
          treeEntries.push({
            path,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
      }
    }
  }

  // 画像パス配列の構築
  const imagePaths = imageArr.map((_: unknown, i: number) => {
    const seqName = `image${String(i + 1).padStart(3, "0")}.jpg`;
    return `/${newImageDir}/${seqName}`;
  });

  // サムネイル決定
  let thumbnailName = "";
  if (imagePaths.length > 0) {
    const thumbIdx =
      typeof thumbnailIndex === "number" &&
      thumbnailIndex >= 0 &&
      thumbnailIndex < imagePaths.length
        ? thumbnailIndex
        : 0;
    thumbnailName = `image${String(thumbIdx + 1).padStart(3, "0")}.jpg`;
  }

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
});

// --- Helper types & functions ---

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

async function getTreeFiles(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  treeSha: string,
): Promise<Map<string, string>> {
  const fileMap = new Map<string, string>();

  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "true",
  });

  for (const item of tree.tree) {
    if (item.type === "blob" && item.path && item.sha) {
      fileMap.set(item.path, item.sha);
    }
  }

  return fileMap;
}

async function checkDuplicate(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  filePath: string,
  excludePrNumber?: number,
) {
  // mainブランチでの確認
  try {
    await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: "main",
    });
    throw new HTTPException(409, {
      message: "同じ日付・タイトルの記事が既に存在します",
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    if (error instanceof RequestError && error.status !== 404) throw error;
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

export { checkDuplicate };
export default articles;
