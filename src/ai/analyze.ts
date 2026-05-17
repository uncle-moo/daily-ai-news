import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./provider.js";
import type { AnalyzedReport, NormalizedItem, RuntimeConfig } from "../types.js";

// ── Schema: phase 1 — pick top item IDs ──────────────────────────────────────

const selectionSchema = z.object({
  selectedIds: z.array(z.string()),
});

// ── Schema: phase 2 — full report ────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

type GenerateObjectLike = (options: {
  model: ReturnType<typeof getLanguageModel>;
  schema: z.ZodTypeAny;
  prompt: string;
  mode?: "auto" | "json" | "tool";
}) => Promise<{ object: unknown }>;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

// ── Phase 1: select top items by title only ───────────────────────────────────

async function selectTopItems(
  items: NormalizedItem[],
  topN: number,
  date: string,
  config: RuntimeConfig,
  generate: GenerateObjectLike,
): Promise<NormalizedItem[]> {
  // Build a minimal index: id → item
  const index = new Map(items.map((item) => [item.id, item]));

  const candidates = items.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    sourceType: item.sourceType,
  }));

  const prompt = [
    `You are curating a Chinese daily AI news digest for ${date}.`,
    `From the list below, select the ${topN} most newsworthy and impactful items.`,
    "Prefer: major model releases, research breakthroughs, significant open-source tools, industry shifts.",
    "Avoid: minor updates, marketing posts, duplicates.",
    "Return only the selected item IDs in the selectedIds array.",
    "",
    JSON.stringify(candidates, null, 2),
  ].join("\n");

  const result = await withRetry(() =>
    generate({
      model: getLanguageModel(config),
      schema: selectionSchema,
      prompt,
      mode: "json",
    }),
  );

  const { selectedIds } = result.object as z.infer<typeof selectionSchema>;

  // Map selected IDs back to items, preserving selection order
  const selected = selectedIds
    .map((id) => index.get(id))
    .filter((item): item is NormalizedItem => item !== undefined);

  // Fallback: if model returned bad IDs, just take the first topN
  return selected.length > 0 ? selected.slice(0, topN) : items.slice(0, topN);
}

// ── Phase 2: deep analysis on selected items ──────────────────────────────────

async function buildReport(
  items: NormalizedItem[],
  date: string,
  config: RuntimeConfig,
  generate: GenerateObjectLike,
): Promise<AnalyzedReport> {
  const prompt = [
    `You are preparing a Chinese daily AI news report for ${date}.`,
    "Use only the provided items. Do not invent facts.",
    "Merge duplicate or near-duplicate items.",
    "Classify regular updates into news and GitHub/tool items into repositories.",
    "All summaries must be concise Chinese.",
    "Every news item must keep at least one source URL.",
    "",
    JSON.stringify(compactItems(items), null, 2),
  ].join("\n");

  const result = await withRetry(() =>
    generate({
      model: getLanguageModel(config),
      schema: analyzedReportSchema,
      prompt,
      mode: "json",
    }),
  );

  return result.object as AnalyzedReport;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeItems({
  items,
  date,
  config,
  generate = generateObject,
  topN = config.maxItemsForAnalysis,
}: {
  items: NormalizedItem[];
  date: string;
  config: RuntimeConfig;
  generate?: GenerateObjectLike;
  topN?: number;
}): Promise<AnalyzedReport> {
  // Skip selection phase if items already fit within the limit
  const selected =
    items.length <= topN
      ? items
      : await selectTopItems(items, topN, date, config, generate);

  return buildReport(selected, date, config, generate);
}
