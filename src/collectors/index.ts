import type { SourcesConfig } from "../types.js";
import { log } from "../log.js";
import type { NormalizedItem } from "../types.js";
import { createGitHubCollector } from "./github.js";
import { createGitHubTrendingCollector } from "./github-trending.js";
import { createHackerNewsCollector } from "./hacker-news.js";
import { createHuggingFacePapersCollector } from "./huggingface-papers.js";
import { createRssCollector } from "./rss.js";
import type { Collector, CollectorContext } from "./types.js";

export function createCollectorsFromConfig(sources: SourcesConfig): Collector[] {
  const collectors: Collector[] = [];

  if (sources.enabledSources.has("rss")) {
    collectors.push(...sources.rssSources.map(createRssCollector));
  }

  if (sources.enabledSources.has("github")) {
    collectors.push(createGitHubCollector());
  }

  if (sources.enabledSources.has("github-trending")) {
    collectors.push(createGitHubTrendingCollector());
  }

  if (sources.enabledSources.has("hugging-face")) {
    collectors.push(createHuggingFacePapersCollector());
  }

  if (sources.enabledSources.has("hacker-news")) {
    collectors.push(createHackerNewsCollector());
  }

  return collectors;
}

export async function runCollectors(collectors: Collector[], context: CollectorContext): Promise<NormalizedItem[]> {
  const settled = await Promise.allSettled(collectors.map((collector) => collector.collect(context)));
  const items: NormalizedItem[] = [];

  settled.forEach((result, index) => {
    const collector = collectors[index];
    if (!collector) return;

    if (result.status === "fulfilled") {
      items.push(...result.value);
      log.info(`Collector succeeded: ${collector.name}`, { count: result.value.length });
    } else {
      log.warn(`Collector failed: ${collector.name}`, {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  return items;
}
