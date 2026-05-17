import { describe, expect, it } from "vitest";
import { normalizeGitHubRepo } from "../src/collectors/github.js";

describe("normalizeGitHubRepo", () => {
  it("normalizes repository search result", () => {
    const item = normalizeGitHubRepo({
      full_name: "acme/agent-tool",
      html_url: "https://github.com/acme/agent-tool",
      description: "An AI agent tool",
      language: "TypeScript",
      stargazers_count: 123,
      forks_count: 4,
      license: { spdx_id: "MIT" },
      created_at: "2026-05-15T01:00:00Z",
      updated_at: "2026-05-15T02:00:00Z",
      topics: ["llm", "agent"],
    });

    expect(item.repo?.fullName).toBe("acme/agent-tool");
    expect(item.title).toBe("acme/agent-tool");
    expect(item.sourceType).toBe("github");
    expect(item.tags).toContain("llm");
  });
});
