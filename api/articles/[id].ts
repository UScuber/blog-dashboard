import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOctokit, getRepo } from "../lib/github";
import { verifyAuth } from "../lib/auth";
import { toJekyllMarkdown } from "../lib/markdown";

/** 画像のインデックスから連番ファイル名を生成 */
function toSequentialFilename(index: number, ext: string): string {
  return `image${String(index + 1).padStart(3, "0")}${ext}`;
}

/** ファイル名から拡張子を取得 */
function getExt(filename: string): string {
  return filename.includes(".")
    ? filename.substring(filename.lastIndexOf("."))
    : ".jpg";
}

interface ImageInput {
  filename: string;
  data: string;
  isNew?: boolean;
  originalPath?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAuth(req);
    const octokit = getOctokit();
    const { owner, repo } = getRepo();

    const pullNumber = Number(req.query.id);
    if (isNaN(pullNumber)) {
      return res.status(400).json({ error: "Invalid pull request number" });
    }

    const { title, date, body, images, categories, outline, thumbnailIndex } =
      req.body as {
        title: string;
        date: string;
        body: string;
        images?: ImageInput[];
        categories?: string[];
        outline?: string;
        thumbnailIndex?: number;
      };

    if (!title || !date || !body) {
      return res.status(400).json({ error: "title, date, body are required" });
    }

    // 1. PR からブランチ名を取得
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    const branchName = pr.head.ref;

    // 2. PRの変更ファイル一覧を取得
    const { data: prFiles } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    // 3. ブランチの最新コミット・ツリーSHAを取得
    const { data: branchRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
    const latestCommitSha = branchRef.object.sha;
    const { data: latestCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = latestCommit.tree.sha;

    // 4. Gitツリーから全ファイルのBlob SHAを取得
    const { data: fullTree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: baseTreeSha,
      recursive: "1",
    });
    const blobMap = new Map<string, string>();
    for (const item of fullTree.tree) {
      if (item.type === "blob" && item.sha && item.path) {
        blobMap.set(item.path, item.sha);
      }
    }

    // 5. 新旧の画像ディレクトリ名を決定
    const postSlug = `${date}-${title}`;
    const imageDir = `assets/img/blog/${postSlug}`;

    let oldImageDir: string | null = null;
    for (const f of prFiles) {
      if (
        f.filename.startsWith("assets/img/blog/") &&
        f.filename.split("/").length > 4 &&
        f.status !== "removed"
      ) {
        oldImageDir = f.filename.split("/").slice(0, 4).join("/");
        break;
      }
    }
    const dirChanged = oldImageDir !== null && oldImageDir !== imageDir;
    const sourceDir = dirChanged ? oldImageDir! : imageDir;

    // ソースディレクトリの既存画像ファイル一覧（ツリーから取得）
    const sourceDirPrefix = sourceDir + "/";
    const existingImageFiles: { name: string; path: string }[] = [];
    for (const [path] of blobMap) {
      if (
        path.startsWith(sourceDirPrefix) &&
        path.indexOf("/", sourceDirPrefix.length) === -1
      ) {
        const name = path.substring(sourceDirPrefix.length);
        existingImageFiles.push({ name, path });
      }
    }

    // 6. Git Treeエントリを構築（全変更を1コミットにまとめる）
    const treeEntries: {
      path: string;
      mode: "100644";
      type: "blob";
      sha: string | null;
    }[] = [];
    const imagePaths: string[] = [];
    const finalFilenames = new Set<string>();

    if (images && images.length > 0) {
      // 新規画像のBlob作成を並列実行
      const blobPromises: Promise<{ index: number; sha: string }>[] = [];
      for (let i = 0; i < images.length; i++) {
        if (images[i].isNew) {
          blobPromises.push(
            octokit.git
              .createBlob({
                owner,
                repo,
                content: images[i].data,
                encoding: "base64",
              })
              .then(({ data }) => ({ index: i, sha: data.sha })),
          );
        }
      }
      const newBlobs = await Promise.all(blobPromises);
      const newBlobShaMap = new Map(newBlobs.map((b) => [b.index, b.sha]));

      // 画像ツリーエントリを構築
      for (let i = 0; i < images.length; i++) {
        const ext = getExt(images[i].filename);
        const newFilename = toSequentialFilename(i, ext);
        const newPath = `${imageDir}/${newFilename}`;
        finalFilenames.add(newFilename);
        imagePaths.push(`/${newPath}`);

        if (images[i].isNew) {
          // 新規画像: 作成済みBlobのSHAを使用
          treeEntries.push({
            path: newPath,
            mode: "100644",
            type: "blob",
            sha: newBlobShaMap.get(i)!,
          });
        } else {
          // 既存画像: originalPathの完全パスでBlob SHAを照合
          const oldPath = (images[i].originalPath || "").replace(/^\//, "");

          if (!oldPath) {
            return res.status(400).json({
              error: `既存画像（index ${i}）の originalPath が未設定です`,
            });
          }

          if (!blobMap.has(oldPath)) {
            return res.status(400).json({
              error: `既存画像（index ${i}）のファイルが見つかりません: ${oldPath}`,
            });
          }

          if (oldPath !== newPath) {
            // ディレクトリ変更 or 連番変更 → 明示的にコピー
            treeEntries.push({
              path: newPath,
              mode: "100644",
              type: "blob",
              sha: blobMap.get(oldPath)!,
            });
          } else if (dirChanged) {
            // dirChanged=true なのに oldPath === newPath は矛盾
            return res.status(500).json({
              error: `Internal error: directory changed but paths match for image ${i}`,
            });
          }
          // oldPath === newPath かつ dirChanged=false → ベースツリーからそのまま引き継ぐ
        }
      }

      // 不要画像の削除エントリ
      if (dirChanged) {
        // ディレクトリ変更時: 旧ディレクトリの全ファイルを削除
        for (const file of existingImageFiles) {
          treeEntries.push({
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
      } else {
        // 同一ディレクトリ: finalFilenamesに含まれない孤立画像を削除
        for (const file of existingImageFiles) {
          if (!finalFilenames.has(file.name)) {
            treeEntries.push({
              path: file.path,
              mode: "100644",
              type: "blob",
              sha: null,
            });
          }
        }
      }
    } else {
      // 画像がすべて削除された場合: 既存ファイルをすべて削除
      for (const file of existingImageFiles) {
        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: null,
        });
      }
    }

    // 7. PRの変更ファイルから既存の_postsファイルを特定
    const postFile = prFiles.find(
      (f) => f.filename.startsWith("_posts/") && f.filename.endsWith(".md"),
    );
    if (!postFile) {
      return res
        .status(404)
        .json({ error: "Post file not found in PR changes" });
    }
    const existingFilePath = postFile.filename;

    // 8. サムネイル画像名の決定
    const thumbIdx =
      typeof thumbnailIndex === "number" &&
      thumbnailIndex >= 0 &&
      images &&
      thumbnailIndex < images.length
        ? thumbnailIndex
        : 0;
    const imgFilename =
      images && images.length > 0
        ? toSequentialFilename(thumbIdx, getExt(images[thumbIdx].filename))
        : "";

    // 9. Markdown 再生成 → Blob作成 → ツリーエントリ追加
    const markdown = toJekyllMarkdown({
      title,
      date,
      categories: categories || [],
      outline: outline || "",
      img: imgFilename,
      thumb: imgFilename,
      body,
      images: imagePaths,
    });

    const { data: markdownBlob } = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(markdown).toString("base64"),
      encoding: "base64",
    });

    const newPostPath = `_posts/${postSlug}.md`;
    treeEntries.push({
      path: newPostPath,
      mode: "100644",
      type: "blob",
      sha: markdownBlob.sha,
    });

    // パスが変わった場合、旧ファイルを削除
    if (existingFilePath !== newPostPath) {
      treeEntries.push({
        path: existingFilePath,
        mode: "100644",
        type: "blob",
        sha: null,
      });
    }

    // 10. ツリー作成 → コミット作成 → ブランチ更新（すべて1コミット）
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeEntries as any,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `Update post: ${title}`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
      sha: newCommit.sha,
    });

    // 11. タイトル変更時は PR タイトルも更新
    if (pr.title !== `post: ${title}`) {
      await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        title: `post: ${title}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        pullNumber,
        branch: branchName,
        filePath: newPostPath,
      },
    });
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Pull request or file not found" });
    }
    return res.status(500).json({ error: err.message });
  }
}
