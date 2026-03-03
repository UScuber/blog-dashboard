import { Octokit } from "@octokit/rest";

let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (octokitInstance) return octokitInstance;

  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error("GITHUB_PAT environment variable is not set");
  }

  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
}

export function getRepo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!owner) {
    throw new Error("GITHUB_REPO_OWNER environment variable is not set");
  }
  if (!repo) {
    throw new Error("GITHUB_REPO_NAME environment variable is not set");
  }

  return { owner, repo };
}
