import { describe, expect, it } from "vitest";
import { dedupeItems, isAiRelevant } from "../src/normalize/dedupe.js";
import type { NormalizedItem } from "../src/types.js";

function item(overrides: Partial<NormalizedItem>): NormalizedItem {
  return {
    id: overrides.id ?? "1",
    source: overrides.source ?? "source",
    sourceType: overrides.sourceType ?? "rss",
    title: overrides.title ?? "AI agent framework",
    url: overrides.url ?? "https://example.com/a",
    ...overrides,
  };
}

describe("dedupeItems", () => {
  it("deduplicates by canonical URL and repo full name", () => {
    const result = dedupeItems([
      item({ id: "1", url: "https://example.com/a?utm_source=x" }),
      item({ id: "2", url: "https://example.com/a" }),
      item({
        id: "3",
        url: "https://github.com/acme/tool",
        repo: { fullName: "acme/tool", url: "https://github.com/acme/tool" },
      }),
      item({
        id: "4",
        url: "https://github.com/acme/tool?tab=readme",
        repo: { fullName: "acme/tool", url: "https://github.com/acme/tool" },
      }),
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("isAiRelevant", () => {
  it("keeps AI-related titles and summaries", () => {
    expect(isAiRelevant(item({ title: "New multimodal LLM for coding" }))).toBe(true);
    expect(isAiRelevant(item({ title: "Quarterly finance results", summary: "No AI content" }))).toBe(false);
  });
});
