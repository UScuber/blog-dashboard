import { HTTPException } from "hono/http-exception";
import type { TreeEntry } from "./git-tree";
import type { ImageInput } from "./types";
import { compressImage, getImageSequenceName } from "./image";
import type { getOctokit } from "./github";

interface BuildImageTreeParams {
  images: ImageInput[];
  newImageDir: string;
  oldImageDir: string | null;
  imageDirChanged: boolean;
  existingFiles: Map<string, string>;
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
}

export async function buildImageTreeEntries(
  params: BuildImageTreeParams,
): Promise<TreeEntry[]> {
  const {
    images,
    newImageDir,
    oldImageDir,
    imageDirChanged,
    existingFiles,
    octokit,
    owner,
    repo,
  } = params;

  const treeEntries: TreeEntry[] = [];

  if (images.length > 0) {
    // 画像のツリーエントリ構築
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const seqName = getImageSequenceName(i);
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

        const normalizedPath = img.originalPath.replace(/^\//, "");
        const existingBlob = existingFiles.get(normalizedPath);
        if (!existingBlob) {
          throw new HTTPException(400, {
            message: `既存画像ファイルが見つかりません: ${normalizedPath}`,
          });
        }

        if (normalizedPath !== newPath) {
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
      for (let i = 0; i < images.length; i++) {
        finalNames.add(`${newImageDir}/${getImageSequenceName(i)}`);
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

  return treeEntries;
}
