import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "../src/pipeline.js";
import type { Collector } from "../src/collectors/types.js";
import type { AnalyzedReport, RuntimeConfig, TimeWindow } from "../src/types.js";

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

const collectors: Collector[] = [
  {
    name: "fixture",
    collect: async () => [
      {
        id: "1",
        source: "fixture",
        sourceType: "rss",
        title: "New LLM",
        url: "https://example.com/llm",
        summary: "AI model update",
      },
    ],
  },
];

const analyzed: AnalyzedReport = {
  date: "2026-05-15",
  highlights: ["重点"],
  news: [{ title: "New LLM", summary: "新模型", whyImportant: "重要", importance: 4, sources: ["https://example.com/llm"] }],
  repositories: [],
  rejected: [],
};

describe("runPipeline", () => {
  it("writes report and calls notifier", async () => {
    const dir = await mkdtemp(join(tmpdir(), "daily-ai-news-"));
    const notify = vi.fn();
    try {
      const result = await runPipeline({
        config,
        window,
        collectors,
        rootDir: dir,
        analyze: async () => analyzed,
        notify,
      });

      expect(result.reportPath.endsWith("reports/2026-05-15.md")).toBe(true);
      await expect(readFile(result.reportPath, "utf8")).resolves.toContain("# AI 日报 2026-05-15");
      expect(notify).toHaveBeenCalledOnce();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
