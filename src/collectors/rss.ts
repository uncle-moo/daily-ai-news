import Parser from "rss-parser";
import type { NormalizedItem, RssSourceConfig } from "../types.js";
import type { Collector, CollectorContext } from "./types.js";

const parser = new Parser();

interface RssParserItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  creator?: string;
}

export function normalizeRssItem(item: RssParserItem, source: RssSourceConfig): NormalizedItem {
  const title = item.title?.trim() || "Untitled";
  const url = item.link?.trim() || source.url;
  const publishedAt = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : undefined);

  return {
    id: `rss:${source.name}:${url}`,
    source: source.name,
    sourceType: "rss",
    title,
    url,
    publishedAt,
    summary: item.contentSnippet?.trim(),
    authors: item.creator ? [item.creator] : undefined,
    tags: [],
    raw: item,
  };
}

export function createRssCollector(source: RssSourceConfig): Collector {
  return {
    name: `rss:${source.name}`,
    async collect(context: CollectorContext): Promise<NormalizedItem[]> {
      const feed = await parser.parseURL(source.url);
      return feed.items
        .map((item) => normalizeRssItem(item as RssParserItem, source))
        .filter((item) => {
          if (!item.publishedAt) return true;
          const published = new Date(item.publishedAt);
          return published >= context.window.start && published <= context.window.end;
        })
        .slice(0, context.config.maxItemsPerSource);
    },
  };
}
