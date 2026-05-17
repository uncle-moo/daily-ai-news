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

type GenerateObjectLike = (options: {
  model: ReturnType<typeof getLanguageModel>;
  schema: typeof analyzedReportSchema;
  prompt: string;
  mode?: "auto" | "json" | "tool";
}) => Promise<{ object: unknown }>;

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
      mode: "json",
    });

  try {
    const result = await run();
    return result.object as AnalyzedReport;
  } catch {
    const retry = await run();
    return retry.object as AnalyzedReport;
  }
}
