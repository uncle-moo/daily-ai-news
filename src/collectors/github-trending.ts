import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface TrendingRepo {
  fullName: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  starsToday: number;
}

export function parseTrendingPage(html: string): TrendingRepo[] {
  const repos: TrendingRepo[] = [];

  // Each repo block starts with a heading like:
  //   ## [owner / repo](https://github.com/owner/repo)
  const repoPattern =
    /##\s+\[([^\]]+)\]\((https:\/\/github\.com\/[^\)]+)\)\n+([\s\S]*?)(?=\n##\s+\[|## Footer|$)/g;

  let match: RegExpExecArray | null;
  while ((match = repoPattern.exec(html)) !== null) {
    const rawName = match[1].replace(/\s+/g, "").replace(/\s/g, "");
    const fullName = match[1].trim().replace(/\s*\/\s*/, "/");
    const url = match[2].trim();
    const block = match[3];

    // Description: first non-empty line after the heading
    const descMatch = block.match(/^\s*([^\n\[★\d][^\n]{3,})/m);
    const description = descMatch ? descMatch[1].trim() : "";

    // Language
    const langMatch = block.match(/\b([A-Z][a-zA-Z+#]+)\b(?=.*star\s)/s) ??
      block.match(/^\s{0,4}([A-Z][a-zA-Z+#]{1,20})\s*\n/m);
    const language = langMatch ? langMatch[1].trim() : "";

    // Total stars: [star 12,345]
    const starsMatch = block.match(/\[star\s+([\d,]+)\]/);
    const stars = starsMatch ? Number.parseInt(starsMatch[1].replace(/,/g, ""), 10) : 0;

    // Forks: [fork 1,234]
    const forksMatch = block.match(/\[fork\s+([\d,]+)\]/);
    const forks = forksMatch ? Number.parseInt(forksMatch[1].replace(/,/g, ""), 10) : 0;

    // Stars today: "397 stars today"
    const todayMatch = block.match(/([\d,]+)\s+stars?\s+today/i);
    const starsToday = todayMatch ? Number.parseInt(todayMatch[1].replace(/,/g, ""), 10) : 0;

    repos.push({ fullName, url, description, language, stars, forks, starsToday });
  }

  return repos;
}

export function normalizeTrendingRepo(repo: TrendingRepo): NormalizedItem {
  return {
    id: `github-trending:${repo.fullName}`,
    source: "GitHub Trending",
    sourceType: "github-trending",
    title: repo.fullName,
    url: repo.url,
    summary: repo.description || undefined,
    tags: repo.language ? [repo.language.toLowerCase()] : [],
    repo: {
      fullName: repo.fullName,
      description: repo.description || undefined,
      language: repo.language || undefined,
      stars: repo.stars,
      forks: repo.forks,
      url: repo.url,
    },
    raw: repo,
  };
}

export function createGitHubTrendingCollector(): Collector {
  return {
    name: "github:trending",
    async collect(context) {
      const { githubTrendingSince, githubTrendingLanguage } = context.config.sources;

      const url = new URL("https://github.com/trending");
      if (githubTrendingSince !== "daily") url.searchParams.set("since", githubTrendingSince);
      if (githubTrendingLanguage) url.searchParams.set("l", githubTrendingLanguage);

      const response = await fetch(url, {
        headers: {
          // Request plain text rendering to get a simpler response
          Accept: "text/html",
          "User-Agent": "Mozilla/5.0 (compatible; daily-ai-news-bot/1.0)",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub Trending request failed: ${response.status}`);
      }

      const html = await response.text();
      const repos = parseTrendingPage(html);

      return repos
        .slice(0, context.config.maxItemsPerSource)
        .map(normalizeTrendingRepo);
    },
  };
}
