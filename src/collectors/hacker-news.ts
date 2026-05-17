import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface HackerNewsHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  created_at?: string;
  author?: string;
  points?: number;
}

const DEFAULT_HN_TERMS = ["LLM", "AI agent", "RAG", "OpenAI", "Anthropic", "DeepMind", "Hugging Face"];

export function normalizeHackerNewsItem(hit: HackerNewsHit): NormalizedItem {
  const title = hit.title ?? hit.story_title ?? "Untitled Hacker News item";
  const url = hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;

  return {
    id: `hn:${hit.objectID}`,
    source: "Hacker News",
    sourceType: "hacker-news",
    title,
    url,
    publishedAt: hit.created_at,
    summary: `${hit.points ?? 0} points on Hacker News`,
    authors: hit.author ? [hit.author] : undefined,
    tags: ["community"],
    raw: hit,
  };
}

export function createHackerNewsCollector(): Collector {
  return {
    name: "hacker-news:algolia",
    async collect(context) {
      const terms = context.config.sources.hackerNewsKeywords.length > 0
        ? context.config.sources.hackerNewsKeywords
        : DEFAULT_HN_TERMS;
      const start = Math.floor(context.window.start.getTime() / 1000);
      const end = Math.floor(context.window.end.getTime() / 1000);
      const hits: HackerNewsHit[] = [];

      for (const term of terms) {
        const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
        url.searchParams.set("query", term);
        url.searchParams.set("tags", "story");
        url.searchParams.set("numericFilters", `created_at_i>${start},created_at_i<${end}`);
        url.searchParams.set("hitsPerPage", String(Math.min(context.config.maxItemsPerSource, 30)));

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HN request failed: ${response.status}`);
        const data = (await response.json()) as { hits: HackerNewsHit[] };
        hits.push(...data.hits);
      }

      return hits.map(normalizeHackerNewsItem).slice(0, context.config.maxItemsPerSource * terms.length);
    },
  };
}
