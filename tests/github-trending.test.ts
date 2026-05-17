import { describe, expect, it } from "vitest";
import { parseTrendingPage, normalizeTrendingRepo } from "../src/collectors/github-trending.js";

// Minimal HTML snippet that mirrors the rendered output we observed
const SAMPLE_HTML = `
## [oven-sh / bun](https://github.com/oven-sh/bun)

Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one

   Rust[star 91,336](https://github.com/oven-sh/bun/stargazers)[fork 4,556](https://github.com/oven-sh/bun/forks) Built by [@Jarred-Sumner](https://github.com/Jarred-Sumner) 397 stars today

## [K-Dense-AI / scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)

A set of ready to use Agent Skills for research, science, engineering, analysis, finance and writing.

   Python[star 23,277](https://github.com/K-Dense-AI/scientific-agent-skills/stargazers)[fork 2,494](https://github.com/K-Dense-AI/scientific-agent-skills/forks) Built by [@TKassis](https://github.com/TKassis) 673 stars today

## Footer
`;

describe("parseTrendingPage", () => {
  it("parses repo names and URLs", () => {
    const repos = parseTrendingPage(SAMPLE_HTML);
    expect(repos).toHaveLength(2);
    expect(repos[0].fullName).toBe("oven-sh/bun");
    expect(repos[0].url).toBe("https://github.com/oven-sh/bun");
    expect(repos[1].fullName).toBe("K-Dense-AI/scientific-agent-skills");
  });

  it("parses descriptions", () => {
    const repos = parseTrendingPage(SAMPLE_HTML);
    expect(repos[0].description).toContain("JavaScript runtime");
    expect(repos[1].description).toContain("Agent Skills");
  });

  it("parses star counts", () => {
    const repos = parseTrendingPage(SAMPLE_HTML);
    expect(repos[0].stars).toBe(91336);
    expect(repos[0].forks).toBe(4556);
    expect(repos[0].starsToday).toBe(397);
    expect(repos[1].starsToday).toBe(673);
  });
});

describe("normalizeTrendingRepo", () => {
  it("produces a valid NormalizedItem", () => {
    const repo = {
      fullName: "oven-sh/bun",
      url: "https://github.com/oven-sh/bun",
      description: "Fast JS runtime",
      language: "Rust",
      stars: 91336,
      forks: 4556,
      starsToday: 397,
    };

    const item = normalizeTrendingRepo(repo);
    expect(item.id).toBe("github-trending:oven-sh/bun");
    expect(item.sourceType).toBe("github-trending");
    expect(item.source).toBe("GitHub Trending");
    expect(item.tags).toContain("rust");
    expect(item.repo?.stars).toBe(91336);
  });
});
