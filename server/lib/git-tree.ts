import { getOctokit } from "./github";

export interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string | null;
}

export async function getTreeFiles(
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
