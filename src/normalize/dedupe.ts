import type { NormalizedItem } from "../types.js";

const relevantPatterns = [
  /\bai\b/i,
  /\bartificial intelligence\b/i,
  /\bllm\b/i,
  /\blanguage model\b/i,
  /\bagents?\b/i,
  /\brag\b/i,
  /\bmultimodal\b/i,
  /\bdiffusion\b/i,
  /\btransformers?\b/i,
  /\binference\b/i,
  /\bfine-tuning\b/i,
  /\bembeddings?\b/i,
  /\bmcp\b/i,
  /\bmodels?\b/i,
];

const irrelevantPatterns = [
  /\bno ai content\b/i,
  /\bwithout ai\b/i,
  /\bnon-ai\b/i,
];

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

export function isAiRelevant(item: NormalizedItem): boolean {
  const text = `${item.title} ${item.summary ?? ""} ${(item.tags ?? []).join(" ")}`;
  if (irrelevantPatterns.some((pattern) => pattern.test(text))) return false;
  return relevantPatterns.some((pattern) => pattern.test(text));
}

export function dedupeItems(items: NormalizedItem[]): NormalizedItem[] {
  const seen = new Set<string>();
  const result: NormalizedItem[] = [];

  for (const item of items) {
    const key = item.repo?.fullName
      ? `repo:${item.repo.fullName.toLowerCase()}`
      : `url:${canonicalUrl(item.url)}|title:${normalizedTitle(item.title)}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function filterAndDedupeItems(items: NormalizedItem[]): NormalizedItem[] {
  return dedupeItems(items.filter(isAiRelevant));
}
