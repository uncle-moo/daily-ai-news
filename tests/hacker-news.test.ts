import { describe, expect, it } from "vitest";
import { normalizeHackerNewsItem } from "../src/collectors/hacker-news.js";

describe("normalizeHackerNewsItem", () => {
  it("normalizes Algolia HN result", () => {
    const item = normalizeHackerNewsItem({
      objectID: "1",
      title: "Open source LLM agent",
      url: "https://example.com/agent",
      created_at: "2026-05-15T12:00:00Z",
      author: "alice",
      points: 42,
    });

    expect(item.source).toBe("Hacker News");
    expect(item.title).toBe("Open source LLM agent");
    expect(item.authors).toEqual(["alice"]);
    expect(item.summary).toContain("42 points");
  });
});
