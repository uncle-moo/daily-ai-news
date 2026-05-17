import { request } from "@octokit/request";
import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface GitHubRepoSearchItem {
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  license?: { spdx_id?: string | null } | null;
  created_at?: string;
  updated_at?: string;
  topics?: string[];
}

export function normalizeGitHubRepo(repo: GitHubRepoSearchItem): NormalizedItem {
  return {
    id: `github:${repo.full_name}`,
    source: "GitHub Search",
    sourceType: "github",
    title: repo.full_name,
    url: repo.html_url,
    publishedAt: repo.updated_at ?? repo.created_at,
    summary: repo.description ?? undefined,
    tags: repo.topics ?? [],
    repo: {
      fullName: repo.full_name,
      description: repo.description ?? undefined,
      language: repo.language ?? undefined,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      license: repo.license?.spdx_id ?? undefined,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      topics: repo.topics,
      url: repo.html_url,
    },
    raw: repo,
  };
}

export function createGitHubCollector(): Collector {
  return {
    name: "github:search",
    async collect(context) {
      const keywords = context.config.sources.githubKeywords;
      const since = context.window.start.toISOString().slice(0, 10);
      const headers = context.config.githubToken ? { authorization: `Bearer ${context.config.githubToken}` } : undefined;
      const results: NormalizedItem[] = [];

      for (const keyword of keywords) {
        const query = `${keyword} pushed:>=${since} stars:>=20`;
        const response = await request("GET /search/repositories", {
          q: query,
          sort: "updated",
          order: "desc",
          per_page: Math.min(context.config.maxItemsPerSource, 30),
          headers,
        });

        const items = response.data.items as GitHubRepoSearchItem[];
        results.push(...items.map(normalizeGitHubRepo));
      }

      return results.slice(0, context.config.maxItemsPerSource * keywords.length);
    },
  };
}
