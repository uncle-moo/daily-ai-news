import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface HFPaperAuthor {
  name: string;
}

interface HFPaper {
  paper: {
    id: string;
    title: string;
    summary?: string;
    ai_summary?: string;
    publishedAt: string;
    authors: HFPaperAuthor[];
    upvotes?: number;
    ai_keywords?: string[];
  };
  publishedAt: string;
  title: string;
  summary?: string;
}

export function normalizeHFPaper(item: HFPaper): NormalizedItem {
  const paper = item.paper;
  return {
    id: `hf-paper:${paper.id}`,
    source: "Hugging Face Papers",
    sourceType: "hugging-face",
    title: paper.title,
    url: `https://huggingface.co/papers/${paper.id}`,
    publishedAt: item.publishedAt,
    summary: paper.ai_summary ?? paper.summary,
    authors: paper.authors.map((a) => a.name),
    tags: paper.ai_keywords ?? [],
    raw: item,
  };
}

export function createHuggingFacePapersCollector(): Collector {
  return {
    name: "huggingface:daily-papers",
    async collect(context) {
      const response = await fetch("https://huggingface.co/api/daily_papers", {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Hugging Face Papers API failed: ${response.status}`);
      }

      const papers = (await response.json()) as HFPaper[];

      return papers
        .filter((item) => {
          const published = new Date(item.publishedAt);
          return published >= context.window.start && published <= context.window.end;
        })
        .slice(0, context.config.maxItemsPerSource)
        .map(normalizeHFPaper);
    },
  };
}
