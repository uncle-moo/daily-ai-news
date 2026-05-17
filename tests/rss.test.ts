import { describe, expect, it } from "vitest";
import { normalizeRssItem } from "../src/collectors/rss.js";

describe("normalizeRssItem", () => {
  it("normalizes an RSS item into a NormalizedItem", () => {
    const item = normalizeRssItem(
      {
        title: "New AI model",
        link: "https://example.com/model",
        isoDate: "2026-05-15T08:00:00.000Z",
        contentSnippet: "A concise summary",
        creator: "Example Author",
      },
      { name: "Example RSS", url: "https://example.com/feed.xml" },
    );

    expect(item).toMatchObject({
      source: "Example RSS",
      sourceType: "rss",
      title: "New AI model",
      url: "https://example.com/model",
      publishedAt: "2026-05-15T08:00:00.000Z",
      summary: "A concise summary",
      authors: ["Example Author"],
      tags: [],
    });
    expect(item.id).toContain("rss:");
  });
});
