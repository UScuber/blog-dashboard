import { Octokit } from "@octokit/rest";

let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (octokitInstance) return octokitInstance;

  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error("GITHUB_PAT が設定されていません");
  }

  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
}

export function getRepoInfo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!owner || !repo) {
    throw new Error(
      "GITHUB_REPO_OWNER または GITHUB_REPO_NAME が設定されていません"
    );
  }

  return { owner, repo };
}
