# Daily AI News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions scheduled TypeScript CLI that collects daily AI updates, uses Vercel AI SDK for cleaning and analysis, writes a Markdown report, and sends a Feishu summary.

**Architecture:** The CLI runs a linear pipeline: config -> collectors -> normalization/deduplication -> AI analysis -> Markdown rendering -> storage -> Feishu notification. Each external integration is behind a small module so source failures are isolated and future search providers can be added without changing the pipeline.

**Tech Stack:** TypeScript, Node.js 20, pnpm, Vitest, tsx, zod, Vercel AI SDK, rss-parser, octokit/request, dotenv, GitHub Actions.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`: strict TypeScript config.
- `vitest.config.ts`: test config.
- `.gitignore`: Node, env, build, and local output ignores.
- `.env.example`: documented local environment variables.
- `src/index.ts`: CLI entry point and top-level error handling.
- `src/pipeline.ts`: orchestrates the full daily report workflow.
- `src/types.ts`: shared item, report, repo, and runtime types.
- `src/config/env.ts`: reads and validates environment variables.
- `src/config/sources.ts`: fixed source definitions and GitHub keywords.
- `src/time.ts`: computes the Asia/Shanghai daily window.
- `src/collectors/types.ts`: collector interface.
- `src/collectors/rss.ts`: RSS collector.
- `src/collectors/github.ts`: GitHub Search collector.
- `src/collectors/hacker-news.ts`: Hacker News collector.
- `src/collectors/index.ts`: collector registry and concurrent runner.
- `src/normalize/dedupe.ts`: URL/title/repo deduplication and relevance filtering.
- `src/ai/provider.ts`: Vercel AI SDK provider selection.
- `src/ai/analyze.ts`: structured LLM cleanup and repo analysis.
- `src/render/markdown.ts`: full report and Feishu Markdown rendering.
- `src/storage/reports.ts`: report file writing.
- `src/notifiers/feishu.ts`: Feishu signing, chunking, and sending.
- `src/log.ts`: small redacting logger.
- `tests/`: unit and integration tests with fixtures.
- `.github/workflows/daily.yml`: scheduled/manual workflow, artifact upload, optional commit.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `package.json`**

Use this exact content:

```json
{
  "name": "daily-ai-news",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts --dry-run",
    "start": "tsx src/index.ts",
    "dry-run": "tsx src/index.ts --dry-run",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1.2.12",
    "@ai-sdk/google": "^1.2.22",
    "@ai-sdk/openai": "^1.3.23",
    "@octokit/request": "^9.2.4",
    "ai": "^4.3.16",
    "dotenv": "^16.5.0",
    "rss-parser": "^3.13.0",
    "zod": "^3.25.28"
  },
  "devDependencies": {
    "@types/node": "^22.15.18",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "pnpm@10.11.0"
}
```

- [ ] **Step 2: Create TypeScript and test config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
});
```

- [ ] **Step 3: Create ignores and env example**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
coverage/
reports/
artifacts/
*.log
```

Create `.env.example`:

```env
TZ=Asia/Shanghai
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GITHUB_TOKEN=
FEISHU_WEBHOOK_URL=
FEISHU_SECRET=
AUTO_COMMIT_REPORT=true
REPORT_ARTIFACT=true
MAX_ITEMS_PER_SOURCE=30
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` is created and install exits with code 0.

- [ ] **Step 5: Verify scaffold**

Run:

```bash
pnpm lint
```

Expected: TypeScript reports no input files or succeeds after source files are added in later tasks. If it reports no input files, continue; Task 2 will add sources.

- [ ] **Step 6: Commit scaffold if Git exists**

Run:

```bash
test -d .git && git add package.json tsconfig.json vitest.config.ts .gitignore .env.example pnpm-lock.yaml && git commit -m "chore: scaffold TypeScript project" || true
```

Expected: If `.git` exists, a commit is created. If not, the command exits successfully without a commit.

---

## Task 2: Shared Types, Time Window, and Env Config

**Files:**
- Create: `src/types.ts`
- Create: `src/time.ts`
- Create: `src/config/env.ts`
- Test: `tests/time.test.ts`
- Test: `tests/env.test.ts`

- [ ] **Step 1: Add shared types**

Create `src/types.ts`:

```ts
export type SourceType = "rss" | "github" | "hacker-news" | "hugging-face" | "arxiv" | "search";

export interface TimeWindow {
  labelDate: string;
  start: Date;
  end: Date;
  timezone: string;
}

export interface RepoMetadata {
  fullName: string;
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  license?: string;
  createdAt?: string;
  updatedAt?: string;
  topics?: string[];
  url: string;
}

export interface RawItem {
  source: string;
  sourceType: SourceType;
  raw: unknown;
}

export interface NormalizedItem {
  id: string;
  source: string;
  sourceType: SourceType;
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
  authors?: string[];
  tags?: string[];
  repo?: RepoMetadata;
  raw?: unknown;
}

export interface AnalyzedNewsItem {
  title: string;
  summary: string;
  whyImportant: string;
  importance: number;
  sources: string[];
}

export interface AnalyzedRepoItem {
  fullName: string;
  summary: string;
  coreCapabilities: string[];
  useCases: string[];
  projectData: string;
  whyWatch: string;
  url: string;
}

export interface AnalyzedReport {
  date: string;
  highlights: string[];
  news: AnalyzedNewsItem[];
  repositories: AnalyzedRepoItem[];
  rejected: string[];
}

export interface RuntimeConfig {
  timezone: string;
  aiProvider: "openai" | "anthropic" | "google";
  aiModel: string;
  githubToken?: string;
  feishuWebhookUrl?: string;
  feishuSecret?: string;
  autoCommitReport: boolean;
  reportArtifact: boolean;
  maxItemsPerSource: number;
  dryRun: boolean;
}
```

- [ ] **Step 2: Write failing time tests**

Create `tests/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getYesterdayWindow } from "../src/time.js";

describe("getYesterdayWindow", () => {
  it("calculates yesterday in Asia/Shanghai from a UTC instant", () => {
    const now = new Date("2026-05-16T14:30:00.000Z");
    const window = getYesterdayWindow(now, "Asia/Shanghai");

    expect(window.labelDate).toBe("2026-05-15");
    expect(window.timezone).toBe("Asia/Shanghai");
    expect(window.start.toISOString()).toBe("2026-05-14T16:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-05-15T15:59:59.999Z");
  });
});
```

- [ ] **Step 3: Implement time window**

Create `src/time.ts`:

```ts
import type { TimeWindow } from "./types.js";

function formatDateInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone ${timezone}`);
  }

  return `${year}-${month}-${day}`;
}

function utcDateForShanghaiLocalMidnight(dateLabel: string): Date {
  const [year, month, day] = dateLabel.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
}

export function getYesterdayWindow(now = new Date(), timezone = "Asia/Shanghai"): TimeWindow {
  if (timezone !== "Asia/Shanghai") {
    throw new Error("Only Asia/Shanghai is supported in the first version");
  }

  const todayLabel = formatDateInZone(now, timezone);
  const todayStart = utcDateForShanghaiLocalMidnight(todayLabel);
  const start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(todayStart.getTime() - 1);
  const labelDate = formatDateInZone(start, timezone);

  return { labelDate, start, end, timezone };
}
```

- [ ] **Step 4: Write env config tests**

Create `tests/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadConfigFromEnv } from "../src/config/env.js";

describe("loadConfigFromEnv", () => {
  it("uses defaults and parses booleans/numbers", () => {
    const config = loadConfigFromEnv({
      AI_PROVIDER: "openai",
      AI_MODEL: "gpt-4.1-mini",
      AUTO_COMMIT_REPORT: "false",
      REPORT_ARTIFACT: "true",
      MAX_ITEMS_PER_SOURCE: "12",
    });

    expect(config.timezone).toBe("Asia/Shanghai");
    expect(config.aiProvider).toBe("openai");
    expect(config.aiModel).toBe("gpt-4.1-mini");
    expect(config.autoCommitReport).toBe(false);
    expect(config.reportArtifact).toBe(true);
    expect(config.maxItemsPerSource).toBe(12);
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      loadConfigFromEnv({
        AI_PROVIDER: "unsupported",
        AI_MODEL: "model",
      }),
    ).toThrow(/AI_PROVIDER/);
  });
});
```

- [ ] **Step 5: Implement env config**

Create `src/config/env.ts`:

```ts
import { z } from "zod";
import type { RuntimeConfig } from "../types.js";

const envSchema = z.object({
  TZ: z.string().default("Asia/Shanghai"),
  AI_PROVIDER: z.enum(["openai", "anthropic", "google"]).default("openai"),
  AI_MODEL: z.string().default("gpt-4.1-mini"),
  GITHUB_TOKEN: z.string().optional(),
  FEISHU_WEBHOOK_URL: z.string().url().optional(),
  FEISHU_SECRET: z.string().optional(),
  AUTO_COMMIT_REPORT: z.string().default("true"),
  REPORT_ARTIFACT: z.string().default("true"),
  MAX_ITEMS_PER_SOURCE: z.string().default("30"),
});

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function loadConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: { dryRun?: boolean } = {},
): RuntimeConfig {
  const parsed = envSchema.parse(env);
  const maxItemsPerSource = Number.parseInt(parsed.MAX_ITEMS_PER_SOURCE, 10);

  if (!Number.isFinite(maxItemsPerSource) || maxItemsPerSource < 1) {
    throw new Error("MAX_ITEMS_PER_SOURCE must be a positive integer");
  }

  return {
    timezone: parsed.TZ,
    aiProvider: parsed.AI_PROVIDER,
    aiModel: parsed.AI_MODEL,
    githubToken: parsed.GITHUB_TOKEN,
    feishuWebhookUrl: parsed.FEISHU_WEBHOOK_URL,
    feishuSecret: parsed.FEISHU_SECRET,
    autoCommitReport: parseBoolean(parsed.AUTO_COMMIT_REPORT),
    reportArtifact: parseBoolean(parsed.REPORT_ARTIFACT),
    maxItemsPerSource,
    dryRun: options.dryRun ?? false,
  };
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test tests/time.test.ts tests/env.test.ts
pnpm lint
```

Expected: both tests pass and TypeScript succeeds.

- [ ] **Step 7: Commit if Git exists**

Run:

```bash
test -d .git && git add src tests package.json tsconfig.json vitest.config.ts && git commit -m "feat: add config and time window" || true
```

Expected: commit is created when `.git` exists.

---

## Task 3: Source Config, Collector Interface, RSS Collector

**Files:**
- Create: `src/config/sources.ts`
- Create: `src/collectors/types.ts`
- Create: `src/collectors/rss.ts`
- Test: `tests/rss.test.ts`

- [ ] **Step 1: Create source config**

Create `src/config/sources.ts`:

```ts
export interface RssSource {
  name: string;
  url: string;
  tags: string[];
}

export const rssSources: RssSource[] = [
  { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml", tags: ["company", "model"] },
  { name: "Anthropic News", url: "https://www.anthropic.com/news/rss.xml", tags: ["company", "model"] },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog/rss.xml", tags: ["research", "company"] },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", tags: ["open-source", "models"] },
  { name: "NVIDIA Technical Blog AI", url: "https://developer.nvidia.com/blog/category/deep-learning/feed/", tags: ["hardware", "developer"] }
];

export const githubKeywords = ["LLM", "agent", "RAG", "MCP", "AI coding", "multimodal"];
```

- [ ] **Step 2: Create collector interface**

Create `src/collectors/types.ts`:

```ts
import type { NormalizedItem, RuntimeConfig, TimeWindow } from "../types.js";

export interface CollectorContext {
  config: RuntimeConfig;
  window: TimeWindow;
}

export interface Collector {
  name: string;
  collect(context: CollectorContext): Promise<NormalizedItem[]>;
}
```

- [ ] **Step 3: Write RSS collector tests**

Create `tests/rss.test.ts`:

```ts
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
      { name: "Example RSS", url: "https://example.com/feed.xml", tags: ["model"] },
    );

    expect(item).toMatchObject({
      source: "Example RSS",
      sourceType: "rss",
      title: "New AI model",
      url: "https://example.com/model",
      publishedAt: "2026-05-15T08:00:00.000Z",
      summary: "A concise summary",
      authors: ["Example Author"],
      tags: ["model"],
    });
    expect(item.id).toContain("rss:");
  });
});
```

- [ ] **Step 4: Implement RSS collector**

Create `src/collectors/rss.ts`:

```ts
import Parser from "rss-parser";
import type { RssSource } from "../config/sources.js";
import type { NormalizedItem } from "../types.js";
import type { Collector, CollectorContext } from "./types.js";

const parser = new Parser();

interface RssParserItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  creator?: string;
}

export function normalizeRssItem(item: RssParserItem, source: RssSource): NormalizedItem {
  const title = item.title?.trim() || "Untitled";
  const url = item.link?.trim() || source.url;
  const publishedAt = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : undefined);

  return {
    id: `rss:${source.name}:${url}`,
    source: source.name,
    sourceType: "rss",
    title,
    url,
    publishedAt,
    summary: item.contentSnippet?.trim(),
    authors: item.creator ? [item.creator] : undefined,
    tags: source.tags,
    raw: item,
  };
}

export function createRssCollector(source: RssSource): Collector {
  return {
    name: `rss:${source.name}`,
    async collect(context: CollectorContext): Promise<NormalizedItem[]> {
      const feed = await parser.parseURL(source.url);
      return feed.items
        .map((item) => normalizeRssItem(item as RssParserItem, source))
        .filter((item) => {
          if (!item.publishedAt) return true;
          const published = new Date(item.publishedAt);
          return published >= context.window.start && published <= context.window.end;
        })
        .slice(0, context.config.maxItemsPerSource);
    },
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test tests/rss.test.ts
pnpm lint
```

Expected: RSS test and TypeScript pass.

- [ ] **Step 6: Commit if Git exists**

Run:

```bash
test -d .git && git add src/config/sources.ts src/collectors tests/rss.test.ts && git commit -m "feat: add RSS collector" || true
```

---

## Task 4: Deduplication and Collector Runner

**Files:**
- Create: `src/normalize/dedupe.ts`
- Create: `src/collectors/index.ts`
- Create: `src/log.ts`
- Test: `tests/dedupe.test.ts`
- Test: `tests/collectors.test.ts`

- [ ] **Step 1: Write dedupe tests**

Create `tests/dedupe.test.ts`:

```ts
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
      item({ id: "3", url: "https://github.com/acme/tool", repo: { fullName: "acme/tool", url: "https://github.com/acme/tool" } }),
      item({ id: "4", url: "https://github.com/acme/tool?tab=readme", repo: { fullName: "acme/tool", url: "https://github.com/acme/tool" } }),
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
```

- [ ] **Step 2: Implement dedupe**

Create `src/normalize/dedupe.ts`:

```ts
import type { NormalizedItem } from "../types.js";

const relevantTerms = [
  "ai",
  "artificial intelligence",
  "llm",
  "language model",
  "agent",
  "rag",
  "multimodal",
  "diffusion",
  "transformer",
  "inference",
  "fine-tuning",
  "embedding",
  "mcp",
  "model",
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
  return title.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

export function isAiRelevant(item: NormalizedItem): boolean {
  const text = `${item.title} ${item.summary ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  return relevantTerms.some((term) => text.includes(term));
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
```

- [ ] **Step 3: Add redacting logger**

Create `src/log.ts`:

```ts
const secretPatterns = [/xoxb-[A-Za-z0-9-]+/g, /https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9-]+/g];

function redact(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
}

export const log = {
  info(message: string, meta?: unknown): void {
    console.log(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
  warn(message: string, meta?: unknown): void {
    console.warn(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
  error(message: string, meta?: unknown): void {
    console.error(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
};
```

- [ ] **Step 4: Write collector runner tests**

Create `tests/collectors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCollectors } from "../src/collectors/index.js";
import type { Collector } from "../src/collectors/types.js";
import type { RuntimeConfig, TimeWindow } from "../src/types.js";

const config: RuntimeConfig = {
  timezone: "Asia/Shanghai",
  aiProvider: "openai",
  aiModel: "model",
  autoCommitReport: true,
  reportArtifact: true,
  maxItemsPerSource: 10,
  dryRun: true,
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
      { name: "ok", collect: async () => [{ id: "1", source: "ok", sourceType: "rss", title: "AI news", url: "https://example.com" }] },
      { name: "bad", collect: async () => { throw new Error("network failed"); } },
    ];

    const items = await runCollectors(collectors, { config, window });

    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("ok");
  });
});
```

- [ ] **Step 5: Implement collector runner**

Create `src/collectors/index.ts`:

```ts
import { rssSources } from "../config/sources.js";
import type { NormalizedItem } from "../types.js";
import { log } from "../log.js";
import { createRssCollector } from "./rss.js";
import type { Collector, CollectorContext } from "./types.js";

export function createDefaultCollectors(): Collector[] {
  return rssSources.map(createRssCollector);
}

export async function runCollectors(collectors: Collector[], context: CollectorContext): Promise<NormalizedItem[]> {
  const settled = await Promise.allSettled(collectors.map((collector) => collector.collect(context)));
  const items: NormalizedItem[] = [];

  settled.forEach((result, index) => {
    const collector = collectors[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
      log.info(`Collector succeeded: ${collector.name}`, { count: result.value.length });
    } else {
      log.warn(`Collector failed: ${collector.name}`, { error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    }
  });

  return items;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test tests/dedupe.test.ts tests/collectors.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 7: Commit if Git exists**

Run:

```bash
test -d .git && git add src tests && git commit -m "feat: add collector runner and dedupe" || true
```

---

## Task 5: GitHub and Hacker News Collectors

**Files:**
- Create: `src/collectors/github.ts`
- Create: `src/collectors/hacker-news.ts`
- Modify: `src/collectors/index.ts`
- Test: `tests/github.test.ts`
- Test: `tests/hacker-news.test.ts`

- [ ] **Step 1: Write GitHub normalization test**

Create `tests/github.test.ts`:

```ts
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
```

- [ ] **Step 2: Implement GitHub collector**

Create `src/collectors/github.ts`:

```ts
import { request } from "@octokit/request";
import { githubKeywords } from "../config/sources.js";
import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface GitHubRepoSearchItem {
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  license?: { spdx_id?: string | null } | null;
  created_at?: string;
  updated_at?: string;
  topics?: string[];
}

export function normalizeGitHubRepo(repo: GitHubRepoSearchItem): NormalizedItem {
  return {
    id: `github:${repo.full_name}`,
    source: "GitHub Search",
    sourceType: "github",
    title: repo.full_name,
    url: repo.html_url,
    publishedAt: repo.updated_at ?? repo.created_at,
    summary: repo.description ?? undefined,
    tags: repo.topics ?? [],
    repo: {
      fullName: repo.full_name,
      description: repo.description ?? undefined,
      language: repo.language ?? undefined,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      license: repo.license?.spdx_id ?? undefined,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      topics: repo.topics,
      url: repo.html_url,
    },
    raw: repo,
  };
}

export function createGitHubCollector(): Collector {
  return {
    name: "github:search",
    async collect(context) {
      const since = context.window.start.toISOString().slice(0, 10);
      const headers = context.config.githubToken ? { authorization: `Bearer ${context.config.githubToken}` } : undefined;
      const results: NormalizedItem[] = [];

      for (const keyword of githubKeywords) {
        const query = `${keyword} pushed:>=${since} stars:>=20`;
        const response = await request("GET /search/repositories", {
          q: query,
          sort: "updated",
          order: "desc",
          per_page: Math.min(context.config.maxItemsPerSource, 30),
          headers,
        });

        const items = response.data.items as GitHubRepoSearchItem[];
        results.push(...items.map(normalizeGitHubRepo));
      }

      return results.slice(0, context.config.maxItemsPerSource * githubKeywords.length);
    },
  };
}
```

- [ ] **Step 3: Write Hacker News test**

Create `tests/hacker-news.test.ts`:

```ts
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
```

- [ ] **Step 4: Implement Hacker News collector**

Create `src/collectors/hacker-news.ts`:

```ts
import type { NormalizedItem } from "../types.js";
import type { Collector } from "./types.js";

interface HackerNewsHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  created_at?: string;
  author?: string;
  points?: number;
}

const hnTerms = ["LLM", "AI agent", "RAG", "OpenAI", "Anthropic", "DeepMind", "Hugging Face"];

export function normalizeHackerNewsItem(hit: HackerNewsHit): NormalizedItem {
  const title = hit.title ?? hit.story_title ?? "Untitled Hacker News item";
  const url = hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;

  return {
    id: `hn:${hit.objectID}`,
    source: "Hacker News",
    sourceType: "hacker-news",
    title,
    url,
    publishedAt: hit.created_at,
    summary: `${hit.points ?? 0} points on Hacker News`,
    authors: hit.author ? [hit.author] : undefined,
    tags: ["community"],
    raw: hit,
  };
}

export function createHackerNewsCollector(): Collector {
  return {
    name: "hacker-news:algolia",
    async collect(context) {
      const start = Math.floor(context.window.start.getTime() / 1000);
      const end = Math.floor(context.window.end.getTime() / 1000);
      const hits: HackerNewsHit[] = [];

      for (const term of hnTerms) {
        const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
        url.searchParams.set("query", term);
        url.searchParams.set("tags", "story");
        url.searchParams.set("numericFilters", `created_at_i>${start},created_at_i<${end}`);
        url.searchParams.set("hitsPerPage", String(Math.min(context.config.maxItemsPerSource, 30)));

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HN request failed: ${response.status}`);
        const data = (await response.json()) as { hits: HackerNewsHit[] };
        hits.push(...data.hits);
      }

      return hits.map(normalizeHackerNewsItem).slice(0, context.config.maxItemsPerSource * hnTerms.length);
    },
  };
}
```

- [ ] **Step 5: Add collectors to registry**

Modify `src/collectors/index.ts` so `createDefaultCollectors` includes GitHub and Hacker News:

```ts
import { rssSources } from "../config/sources.js";
import type { NormalizedItem } from "../types.js";
import { log } from "../log.js";
import { createGitHubCollector } from "./github.js";
import { createHackerNewsCollector } from "./hacker-news.js";
import { createRssCollector } from "./rss.js";
import type { Collector, CollectorContext } from "./types.js";

export function createDefaultCollectors(): Collector[] {
  return [
    ...rssSources.map(createRssCollector),
    createGitHubCollector(),
    createHackerNewsCollector(),
  ];
}

export async function runCollectors(collectors: Collector[], context: CollectorContext): Promise<NormalizedItem[]> {
  const settled = await Promise.allSettled(collectors.map((collector) => collector.collect(context)));
  const items: NormalizedItem[] = [];

  settled.forEach((result, index) => {
    const collector = collectors[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
      log.info(`Collector succeeded: ${collector.name}`, { count: result.value.length });
    } else {
      log.warn(`Collector failed: ${collector.name}`, { error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    }
  });

  return items;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test tests/github.test.ts tests/hacker-news.test.ts tests/collectors.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 7: Commit if Git exists**

Run:

```bash
test -d .git && git add src/collectors tests && git commit -m "feat: add GitHub and Hacker News collectors" || true
```

---

## Task 6: AI Provider and Structured Analysis

**Files:**
- Create: `src/ai/provider.ts`
- Create: `src/ai/analyze.ts`
- Test: `tests/ai-analyze.test.ts`

- [ ] **Step 1: Write AI analysis test using injected mock**

Create `tests/ai-analyze.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeItems } from "../src/ai/analyze.js";
import type { NormalizedItem, RuntimeConfig } from "../src/types.js";

const config: RuntimeConfig = {
  timezone: "Asia/Shanghai",
  aiProvider: "openai",
  aiModel: "model",
  autoCommitReport: true,
  reportArtifact: true,
  maxItemsPerSource: 10,
  dryRun: true,
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
    const report = await analyzeItems({
      items,
      date: "2026-05-15",
      config,
      generate: async () => ({
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
      }),
    });

    expect(report.repositories[0]?.fullName).toBe("acme/agent-tool");
    expect(report.highlights).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement provider selection**

Create `src/ai/provider.ts`:

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { RuntimeConfig } from "../types.js";

export function getLanguageModel(config: RuntimeConfig) {
  if (config.aiProvider === "openai") return openai(config.aiModel);
  if (config.aiProvider === "anthropic") return anthropic(config.aiModel);
  if (config.aiProvider === "google") return google(config.aiModel);
  throw new Error(`Unsupported AI provider: ${config.aiProvider satisfies never}`);
}
```

- [ ] **Step 3: Implement AI analyzer**

Create `src/ai/analyze.ts`:

```ts
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./provider.js";
import type { AnalyzedReport, NormalizedItem, RuntimeConfig } from "../types.js";

const analyzedReportSchema = z.object({
  date: z.string(),
  highlights: z.array(z.string()).max(5),
  news: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      whyImportant: z.string(),
      importance: z.number().min(1).max(5),
      sources: z.array(z.string().url()).min(1),
    }),
  ),
  repositories: z.array(
    z.object({
      fullName: z.string(),
      summary: z.string(),
      coreCapabilities: z.array(z.string()),
      useCases: z.array(z.string()),
      projectData: z.string(),
      whyWatch: z.string(),
      url: z.string().url(),
    }),
  ),
  rejected: z.array(z.string()),
});

type GenerateObjectLike = typeof generateObject;

function compactItems(items: NormalizedItem[]) {
  return items.map((item) => ({
    source: item.source,
    sourceType: item.sourceType,
    title: item.title,
    url: item.url,
    publishedAt: item.publishedAt,
    summary: item.summary,
    tags: item.tags,
    repo: item.repo,
  }));
}

export async function analyzeItems({
  items,
  date,
  config,
  generate = generateObject,
}: {
  items: NormalizedItem[];
  date: string;
  config: RuntimeConfig;
  generate?: GenerateObjectLike;
}): Promise<AnalyzedReport> {
  const prompt = [
    `You are preparing a Chinese daily AI news report for ${date}.`,
    "Use only the provided items. Do not invent facts.",
    "Merge duplicate or near-duplicate items.",
    "Filter weakly relevant marketing content.",
    "Classify regular updates into news and GitHub/tool items into repositories.",
    "All summaries must be concise Chinese.",
    "Every news item must keep at least one source URL.",
    "",
    JSON.stringify(compactItems(items), null, 2),
  ].join("\n");

  const run = async () =>
    generate({
      model: getLanguageModel(config),
      schema: analyzedReportSchema,
      prompt,
    });

  try {
    const result = await run();
    return result.object as AnalyzedReport;
  } catch (error) {
    const retry = await run();
    return retry.object as AnalyzedReport;
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test tests/ai-analyze.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 5: Commit if Git exists**

Run:

```bash
test -d .git && git add src/ai tests/ai-analyze.test.ts && git commit -m "feat: add AI analysis layer" || true
```

---

## Task 7: Markdown Rendering and Report Storage

**Files:**
- Create: `src/render/markdown.ts`
- Create: `src/storage/reports.ts`
- Test: `tests/markdown.test.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write Markdown renderer tests**

Create `tests/markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderFeishuMarkdown, renderFullReportMarkdown } from "../src/render/markdown.js";
import type { AnalyzedReport, TimeWindow } from "../src/types.js";

const report: AnalyzedReport = {
  date: "2026-05-15",
  highlights: ["重点变化"],
  news: [{ title: "模型发布", summary: "发布了新模型", whyImportant: "影响开发者", importance: 5, sources: ["https://example.com"] }],
  repositories: [{ fullName: "acme/tool", summary: "AI 工具", coreCapabilities: ["RAG"], useCases: ["知识库"], projectData: "100 stars", whyWatch: "增长快", url: "https://github.com/acme/tool" }],
  rejected: ["无关内容"],
};

const window: TimeWindow = {
  labelDate: "2026-05-15",
  start: new Date("2026-05-14T16:00:00Z"),
  end: new Date("2026-05-15T15:59:59.999Z"),
  timezone: "Asia/Shanghai",
};

describe("markdown renderers", () => {
  it("renders full report sections", () => {
    const markdown = renderFullReportMarkdown(report, window);
    expect(markdown).toContain("# AI 日报 2026-05-15");
    expect(markdown).toContain("## 今日摘要");
    expect(markdown).toContain("## AI资讯");
    expect(markdown).toContain("## GitHub仓库/工具");
    expect(markdown).toContain("## 候选但未入选");
  });

  it("renders concise Feishu markdown", () => {
    const markdown = renderFeishuMarkdown(report);
    expect(markdown).toContain("# AI 日报 2026-05-15");
    expect(markdown).toContain("**模型发布**");
    expect(markdown).toContain("**acme/tool**");
  });
});
```

- [ ] **Step 2: Implement Markdown renderer**

Create `src/render/markdown.ts`:

```ts
import type { AnalyzedReport, TimeWindow } from "../types.js";

function linkList(urls: string[]): string {
  return urls.map((url) => `[来源](${url})`).join(" ");
}

export function renderFullReportMarkdown(report: AnalyzedReport, window: TimeWindow): string {
  const lines: string[] = [
    `# AI 日报 ${report.date}`,
    "",
    `> 时间窗口：${window.labelDate} 00:00 - 23:59 ${window.timezone}`,
    "",
    "## 今日摘要",
    "",
    ...report.highlights.map((item) => `- ${item}`),
    "",
    "## AI资讯",
    "",
  ];

  report.news.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.title}`, `- 摘要：${item.summary}`, `- 为什么重要：${item.whyImportant}`, `- 重要性：${item.importance}/5`, `- 来源：${linkList(item.sources)}`, "");
  });

  lines.push("## GitHub仓库/工具", "");
  report.repositories.forEach((repo, index) => {
    lines.push(
      `### ${index + 1}. ${repo.fullName}`,
      `- 简介：${repo.summary}`,
      `- 核心能力：${repo.coreCapabilities.join("；")}`,
      `- 适用场景：${repo.useCases.join("；")}`,
      `- 项目数据：${repo.projectData}`,
      `- 关注理由：${repo.whyWatch}`,
      `- 链接：[GitHub](${repo.url})`,
      "",
    );
  });

  lines.push("## 候选但未入选", "");
  if (report.rejected.length === 0) {
    lines.push("- 无");
  } else {
    lines.push(...report.rejected.map((item) => `- ${item}`));
  }

  return `${lines.join("\n").trim()}\n`;
}

export function renderFeishuMarkdown(report: AnalyzedReport): string {
  const lines: string[] = [`# AI 日报 ${report.date}`, "", "## 今日摘要", "", ...report.highlights.map((item) => `- ${item}`), "", "## AI资讯"];

  for (const item of report.news) {
    lines.push(`- **${item.title}**：${item.summary} ${linkList(item.sources)}`);
  }

  lines.push("", "## GitHub仓库/工具");
  for (const repo of report.repositories) {
    lines.push(`- **${repo.fullName}**：${repo.summary} [GitHub](${repo.url})`);
  }

  return `${lines.join("\n").trim()}\n`;
}
```

- [ ] **Step 3: Write storage test**

Create `tests/storage.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeReport } from "../src/storage/reports.js";

describe("writeReport", () => {
  it("writes report to reports/date.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "daily-ai-news-"));
    try {
      const path = await writeReport("2026-05-15", "# Report\n", dir);
      expect(path.endsWith("reports/2026-05-15.md")).toBe(true);
      await expect(readFile(path, "utf8")).resolves.toBe("# Report\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 4: Implement storage**

Create `src/storage/reports.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeReport(date: string, markdown: string, rootDir = process.cwd()): Promise<string> {
  const reportsDir = join(rootDir, "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `${date}.md`);
  await writeFile(reportPath, markdown, "utf8");
  return reportPath;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test tests/markdown.test.ts tests/storage.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 6: Commit if Git exists**

Run:

```bash
test -d .git && git add src/render src/storage tests && git commit -m "feat: render and store reports" || true
```

---

## Task 8: Feishu Notifier

**Files:**
- Create: `src/notifiers/feishu.ts`
- Test: `tests/feishu.test.ts`

- [ ] **Step 1: Write Feishu tests**

Create `tests/feishu.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { chunkMarkdown, createFeishuSignature, sendFeishuMarkdown } from "../src/notifiers/feishu.js";

describe("createFeishuSignature", () => {
  it("matches Feishu HMAC-SHA256 signing format", () => {
    const timestamp = "1715750400";
    const secret = "secret";
    const expected = createHmac("sha256", `${timestamp}\n${secret}`).digest("base64");
    expect(createFeishuSignature(timestamp, secret)).toBe(expected);
  });
});

describe("chunkMarkdown", () => {
  it("splits long markdown at safe size", () => {
    const chunks = chunkMarkdown("a".repeat(12), 5);
    expect(chunks).toEqual(["aaaaa", "aaaaa", "aa"]);
  });
});

describe("sendFeishuMarkdown", () => {
  it("does not send during dry run", async () => {
    const fetchMock = vi.fn();
    await sendFeishuMarkdown({
      markdown: "# Report",
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test",
      dryRun: true,
      fetchImpl: fetchMock,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement Feishu notifier**

Create `src/notifiers/feishu.ts`:

```ts
import { createHmac } from "node:crypto";
import { log } from "../log.js";

export function createFeishuSignature(timestamp: string, secret: string): string {
  return createHmac("sha256", `${timestamp}\n${secret}`).digest("base64");
}

export function chunkMarkdown(markdown: string, maxLength = 3500): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < markdown.length; index += maxLength) {
    chunks.push(markdown.slice(index, index + maxLength));
  }
  return chunks;
}

export async function sendFeishuMarkdown({
  markdown,
  webhookUrl,
  secret,
  dryRun,
  fetchImpl = fetch,
}: {
  markdown: string;
  webhookUrl?: string;
  secret?: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!webhookUrl) {
    log.warn("FEISHU_WEBHOOK_URL is not configured; skipping Feishu notification");
    return;
  }

  if (dryRun) {
    log.info("Dry run enabled; skipping Feishu notification");
    return;
  }

  for (const chunk of chunkMarkdown(markdown)) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload: Record<string, unknown> = {
      msg_type: "interactive",
      card: {
        elements: [{ tag: "markdown", content: chunk }],
      },
    };

    if (secret) {
      payload.timestamp = timestamp;
      payload.sign = createFeishuSignature(timestamp, secret);
    }

    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Feishu notification failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { code?: number; msg?: string };
    if (typeof data.code === "number" && data.code !== 0) {
      throw new Error(`Feishu notification failed: ${data.code} ${data.msg ?? ""}`.trim());
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm test tests/feishu.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 4: Commit if Git exists**

Run:

```bash
test -d .git && git add src/notifiers tests/feishu.test.ts && git commit -m "feat: add Feishu notifier" || true
```

---

## Task 9: Pipeline and CLI Entry Point

**Files:**
- Create: `src/pipeline.ts`
- Create: `src/index.ts`
- Test: `tests/pipeline.test.ts`

- [ ] **Step 1: Write pipeline integration test**

Create `tests/pipeline.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "../src/pipeline.js";
import type { Collector } from "../src/collectors/types.js";
import type { AnalyzedReport, RuntimeConfig, TimeWindow } from "../src/types.js";

const config: RuntimeConfig = {
  timezone: "Asia/Shanghai",
  aiProvider: "openai",
  aiModel: "model",
  autoCommitReport: true,
  reportArtifact: true,
  maxItemsPerSource: 10,
  dryRun: true,
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
    collect: async () => [{ id: "1", source: "fixture", sourceType: "rss", title: "New LLM", url: "https://example.com/llm", summary: "AI model update" }],
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
```

- [ ] **Step 2: Implement pipeline**

Create `src/pipeline.ts`:

```ts
import { analyzeItems } from "./ai/analyze.js";
import { createDefaultCollectors, runCollectors } from "./collectors/index.js";
import type { Collector } from "./collectors/types.js";
import { log } from "./log.js";
import { filterAndDedupeItems } from "./normalize/dedupe.js";
import { sendFeishuMarkdown } from "./notifiers/feishu.js";
import { renderFeishuMarkdown, renderFullReportMarkdown } from "./render/markdown.js";
import { writeReport } from "./storage/reports.js";
import type { AnalyzedReport, NormalizedItem, RuntimeConfig, TimeWindow } from "./types.js";

export async function runPipeline({
  config,
  window,
  collectors = createDefaultCollectors(),
  rootDir = process.cwd(),
  analyze = ({ items, date, config: runtimeConfig }) => analyzeItems({ items, date, config: runtimeConfig }),
  notify = (markdown) =>
    sendFeishuMarkdown({
      markdown,
      webhookUrl: config.feishuWebhookUrl,
      secret: config.feishuSecret,
      dryRun: config.dryRun,
    }),
}: {
  config: RuntimeConfig;
  window: TimeWindow;
  collectors?: Collector[];
  rootDir?: string;
  analyze?: (args: { items: NormalizedItem[]; date: string; config: RuntimeConfig }) => Promise<AnalyzedReport>;
  notify?: (markdown: string) => Promise<void>;
}): Promise<{ reportPath: string; itemCount: number }> {
  const rawItems = await runCollectors(collectors, { config, window });
  const items = filterAndDedupeItems(rawItems);

  if (items.length === 0) {
    throw new Error("No usable AI news items collected");
  }

  log.info("Collected usable items", { count: items.length });
  const report = await analyze({ items, date: window.labelDate, config });
  const fullMarkdown = renderFullReportMarkdown(report, window);
  const feishuMarkdown = renderFeishuMarkdown(report);
  const reportPath = await writeReport(window.labelDate, fullMarkdown, rootDir);

  await notify(feishuMarkdown);

  return { reportPath, itemCount: items.length };
}
```

- [ ] **Step 3: Implement CLI entry point**

Create `src/index.ts`:

```ts
import "dotenv/config";
import { loadConfigFromEnv } from "./config/env.js";
import { getYesterdayWindow } from "./time.js";
import { runPipeline } from "./pipeline.js";
import { log } from "./log.js";

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfigFromEnv(process.env, { dryRun: args.dryRun });
  const window = getYesterdayWindow(new Date(), config.timezone);
  const result = await runPipeline({ config, window });
  log.info("Daily AI news report generated", result);
}

main().catch((error) => {
  log.error("Daily AI news run failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test tests/pipeline.test.ts
pnpm lint
```

Expected: tests pass and TypeScript succeeds.

- [ ] **Step 5: Run dry-run locally**

Run:

```bash
pnpm dry-run
```

Expected: The command attempts live collection, writes a report if items are found, and skips Feishu. If network access is unavailable locally, run `pnpm test` as the verification gate and note that live collection needs GitHub Actions or network-enabled execution.

- [ ] **Step 6: Commit if Git exists**

Run:

```bash
test -d .git && git add src tests && git commit -m "feat: add daily news pipeline" || true
```

---

## Task 10: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/daily.yml`

- [ ] **Step 1: Create workflow**

Create `.github/workflows/daily.yml`:

```yaml
name: Daily AI News

on:
  schedule:
    - cron: "0 1 * * *"
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Run without sending Feishu notification"
        required: false
        default: "false"

permissions:
  contents: write

jobs:
  daily:
    runs-on: ubuntu-latest
    env:
      TZ: Asia/Shanghai
      AI_PROVIDER: ${{ vars.AI_PROVIDER || 'openai' }}
      AI_MODEL: ${{ vars.AI_MODEL || 'gpt-4.1-mini' }}
      AUTO_COMMIT_REPORT: ${{ vars.AUTO_COMMIT_REPORT || 'true' }}
      REPORT_ARTIFACT: ${{ vars.REPORT_ARTIFACT || 'true' }}
      MAX_ITEMS_PER_SOURCE: ${{ vars.MAX_ITEMS_PER_SOURCE || '30' }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      FEISHU_WEBHOOK_URL: ${{ secrets.FEISHU_WEBHOOK_URL }}
      FEISHU_SECRET: ${{ secrets.FEISHU_SECRET }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.11.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Type check
        run: pnpm lint

      - name: Generate report
        run: |
          if [ "${{ github.event.inputs.dry_run }}" = "true" ]; then
            pnpm dry-run
          else
            pnpm start
          fi

      - name: Upload report artifact
        if: always() && env.REPORT_ARTIFACT == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: daily-ai-news-report
          path: reports/*.md
          if-no-files-found: ignore

      - name: Commit report
        if: env.AUTO_COMMIT_REPORT == 'true' && github.event.inputs.dry_run != 'true'
        run: |
          if git diff --quiet -- reports; then
            echo "No report changes to commit"
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add reports/*.md
          git commit -m "chore: add daily AI news report"
          git push
```

- [ ] **Step 2: Verify workflow YAML presence**

Run:

```bash
test -f .github/workflows/daily.yml && sed -n '1,220p' .github/workflows/daily.yml
```

Expected: workflow content prints and includes cron `0 1 * * *`.

- [ ] **Step 3: Commit if Git exists**

Run:

```bash
test -d .git && git add .github/workflows/daily.yml && git commit -m "ci: add daily AI news workflow" || true
```

---

## Task 11: Final Verification and Documentation Check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# Daily AI News

Daily AI News is a GitHub Actions scheduled TypeScript CLI that collects AI-related updates, uses an LLM through Vercel AI SDK to clean and analyze them, writes a Markdown report, and sends a concise summary to a Feishu bot.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm dry-run
```

## Required Secrets

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`, depending on `AI_PROVIDER`
- `FEISHU_WEBHOOK_URL`
- `FEISHU_SECRET`, if the Feishu bot enables signing

## GitHub Variables

- `AI_PROVIDER`: `openai`, `anthropic`, or `google`
- `AI_MODEL`: provider model name
- `AUTO_COMMIT_REPORT`: `true` or `false`
- `REPORT_ARTIFACT`: `true` or `false`
- `MAX_ITEMS_PER_SOURCE`: positive integer

## Schedule

The workflow cron is `0 1 * * *`, which runs at 09:00 Asia/Shanghai.

## Commands

- `pnpm dev`: local dry run
- `pnpm dry-run`: collect and render without sending Feishu
- `pnpm start`: collect, render, and send Feishu
- `pnpm test`: run tests
- `pnpm lint`: TypeScript check
```

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm lint
```

Expected: all tests pass and TypeScript succeeds.

- [ ] **Step 3: Check generated files**

Run:

```bash
rg --files
```

Expected: source, tests, config, workflow, README, spec, and plan files are listed.

- [ ] **Step 4: Commit if Git exists**

Run:

```bash
test -d .git && git add README.md docs src tests .github package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .gitignore .env.example && git commit -m "docs: document daily AI news setup" || true
```

Expected: final documentation commit is created when `.git` exists.

---

## Self-Review

- Spec coverage: The plan covers GitHub Actions scheduling, Vercel AI SDK provider abstraction, fixed-source collection, future search extension point, LLM cleanup, GitHub repository analysis, Markdown report generation, Feishu sending, artifact upload, optional commit, dry-run mode, and tests.
- Placeholder scan: The plan intentionally avoids open placeholders and provides concrete file paths, code, commands, and expected outcomes.
- Type consistency: Shared types in Task 2 are used consistently by collectors, AI analysis, renderers, storage, Feishu notifier, and pipeline.
- Scope check: The implementation remains a CLI and workflow, without adding a database, backend service, or UI.
