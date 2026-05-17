import { describe, expect, it, vi } from "vitest";
import { analyzeItems } from "../src/ai/analyze.js";
import type { NormalizedItem, RuntimeConfig } from "../src/types.js";

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

const items: NormalizedItem[] = [
  {
    id: "1",
    source: "GitHub Search",
    sourceType: "github",
    title: "acme/agent-tool",
    url: "https://github.com/acme/agent-tool",
    summary: "AI agent framework",
    repo: { fullName: "acme/agent-tool", url: "https://github.com/acme/agent-tool", stars: 100 },
  },
];

describe("analyzeItems", () => {
  it("returns validated structured report from injected generator", async () => {
    const generate = vi.fn(async () => ({
      object: {
        date: "2026-05-15",
        highlights: ["Agent tooling gained a new project."],
        news: [],
        repositories: [
          {
            fullName: "acme/agent-tool",
            summary: "A framework for building AI agents.",
            coreCapabilities: ["Agent orchestration"],
            useCases: ["Developer tools"],
            projectData: "100 stars",
            whyWatch: "Early traction and clear scope.",
            url: "https://github.com/acme/agent-tool",
          },
        ],
        rejected: [],
      },
    }));

    const report = await analyzeItems({
      items,
      date: "2026-05-15",
      config,
      generate,
    });

    expect(report.repositories[0]?.fullName).toBe("acme/agent-tool");
    expect(report.highlights).toHaveLength(1);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ mode: "json" }));
  });
});
