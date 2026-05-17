import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import type { RssSourceConfig, SourcesConfig } from "../types.js";

interface SourcesFile {
  rss: Array<{ name: string; url: string }>;
  github?: { enabled?: boolean; keywords?: string[] };
  githubTrending?: {
    enabled?: boolean;
    since?: "daily" | "weekly" | "monthly";
    language?: string;
  };
  huggingFacePapers?: { enabled?: boolean };
  hackerNews?: { enabled?: boolean; keywords?: string[] };
}

const DEFAULT_GITHUB_KEYWORDS = ["LLM", "agent", "RAG", "MCP", "AI coding", "multimodal"];
const DEFAULT_HN_KEYWORDS = ["LLM", "AI agent", "RAG", "OpenAI", "Anthropic", "DeepMind", "Hugging Face"];

export function loadSources(rootDir: string = process.cwd()): SourcesConfig {
  const filePath = resolve(rootDir, "sources.jsonc");

  let raw: SourcesFile;
  try {
    const text = readFileSync(filePath, "utf-8");
    const errors: import("jsonc-parser").ParseError[] = [];
    raw = parseJsonc(text, errors) as SourcesFile;
    if (errors.length > 0) {
      throw new Error(errors.map((e) => `offset ${e.offset}: error code ${e.error}`).join("; "));
    }
  } catch (err) {
    throw new Error(
      `Failed to load sources.jsonc from ${filePath}: ${err instanceof Error ? err.message : String(err)}\n` +
        `Copy sources.example.jsonc to sources.jsonc and edit it to configure your sources.`,
    );
  }

  if (!Array.isArray(raw.rss) || raw.rss.length === 0) {
    throw new Error(`sources.json must contain a non-empty "rss" array`);
  }

  const rssSources: RssSourceConfig[] = raw.rss.map((item, i) => {
    if (typeof item.name !== "string" || typeof item.url !== "string") {
      throw new Error(`sources.json rss[${i}] must have string fields "name" and "url"`);
    }
    return { name: item.name, url: item.url };
  });

  const enabledSources = new Set<"rss" | "github" | "github-trending" | "hacker-news" | "hugging-face">(["rss"]);
  if (raw.github?.enabled !== false) enabledSources.add("github");
  if (raw.githubTrending?.enabled === true) enabledSources.add("github-trending");
  if (raw.huggingFacePapers?.enabled !== false) enabledSources.add("hugging-face");
  if (raw.hackerNews?.enabled !== false) enabledSources.add("hacker-news");

  const githubKeywords =
    Array.isArray(raw.github?.keywords) && raw.github.keywords.length > 0
      ? raw.github.keywords
      : DEFAULT_GITHUB_KEYWORDS;

  const hackerNewsKeywords =
    Array.isArray(raw.hackerNews?.keywords) && raw.hackerNews.keywords.length > 0
      ? raw.hackerNews.keywords
      : DEFAULT_HN_KEYWORDS;

  const validSince = ["daily", "weekly", "monthly"] as const;
  const rawSince = raw.githubTrending?.since;
  const githubTrendingSince: "daily" | "weekly" | "monthly" =
    rawSince && (validSince as readonly string[]).includes(rawSince) ? rawSince : "daily";

  const githubTrendingLanguage = raw.githubTrending?.language ?? "";

  return {
    enabledSources,
    rssSources,
    githubKeywords,
    hackerNewsKeywords,
    githubTrendingSince,
    githubTrendingLanguage,
  };
}
