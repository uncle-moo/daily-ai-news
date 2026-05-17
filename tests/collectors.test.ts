import { describe, expect, it } from "vitest";
import { runCollectors } from "../src/collectors/index.js";
import type { Collector } from "../src/collectors/types.js";
import type { RuntimeConfig, TimeWindow } from "../src/types.js";

const config: RuntimeConfig = {
  timezone: "Asia/Shanghai",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "test-key",
  aiModel: "model",
  autoCommitReport: true,
  reportArtifact: true,
  maxItemsPerSource: 10,
  maxItemsForAnalysis: 10,
  dryRun: true,
  sources: {
    enabledSources: new Set(["rss", "github", "hacker-news"] as const),
    rssSources: [],
    githubKeywords: ["LLM"],
    hackerNewsKeywords: ["LLM"],
    githubTrendingSince: "daily",
    githubTrendingLanguage: "",
  },
};

const window: TimeWindow = {
  labelDate: "2026-05-15",
  start: new Date("2026-05-14T16:00:00Z"),
  end: new Date("2026-05-15T15:59:59.999Z"),
  timezone: "Asia/Shanghai",
};

describe("runCollectors", () => {
  it("keeps successful collector results when one collector fails", async () => {
    const collectors: Collector[] = [
      {
        name: "ok",
        collect: async () => [
          { id: "1", source: "ok", sourceType: "rss", title: "AI news", url: "https://example.com" },
        ],
      },
      {
        name: "bad",
        collect: async () => {
          throw new Error("network failed");
        },
      },
    ];

    const items = await runCollectors(collectors, { config, window });

    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("ok");
  });
});
