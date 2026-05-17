import { describe, expect, it } from "vitest";
import { loadConfigFromEnv } from "../src/config/env.js";
import { resolve } from "node:path";

// Point to the project root which contains sources.json
const rootDir = resolve(import.meta.dirname, "..");

const BASE_ENV = {
  BASE_URL: "https://api.deepseek.com/v1",
  API_KEY: "test-key",
  AI_MODEL: "deepseek-chat",
};

describe("loadConfigFromEnv", () => {
  it("parses basic fields and defaults", () => {
    const config = loadConfigFromEnv(
      { ...BASE_ENV, AUTO_COMMIT_REPORT: "false", REPORT_ARTIFACT: "true", MAX_ITEMS_PER_SOURCE: "12" },
      { rootDir },
    );

    expect(config.timezone).toBe("Asia/Shanghai");
    expect(config.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(config.apiKey).toBe("test-key");
    expect(config.aiModel).toBe("deepseek-chat");
    expect(config.autoCommitReport).toBe(false);
    expect(config.reportArtifact).toBe(true);
    expect(config.maxItemsPerSource).toBe(12);
  });

  it("requires a valid base URL", () => {
    expect(() =>
      loadConfigFromEnv({ ...BASE_ENV, BASE_URL: "not-a-url" }, { rootDir }),
    ).toThrow(/BASE_URL/);
  });

  it("loads rss sources from sources.json", () => {
    const config = loadConfigFromEnv(BASE_ENV, { rootDir });

    expect(config.sources.rssSources.length).toBeGreaterThan(0);
    expect(config.sources.rssSources[0]).toMatchObject({ name: expect.any(String), url: expect.any(String) });
  });

  it("enables github and hacker-news by default", () => {
    const config = loadConfigFromEnv(BASE_ENV, { rootDir });

    expect(config.sources.enabledSources.has("rss")).toBe(true);
    expect(config.sources.enabledSources.has("github")).toBe(true);
    expect(config.sources.enabledSources.has("hacker-news")).toBe(true);
  });

  it("throws when sources.jsonc is missing", () => {
    expect(() =>
      loadConfigFromEnv(BASE_ENV, { rootDir: "/nonexistent/path" }),
    ).toThrow(/sources\.jsonc/);
  });
});
