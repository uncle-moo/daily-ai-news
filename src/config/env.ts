import { z } from "zod";
import type { RuntimeConfig } from "../types.js";
import { loadSources } from "./sources.js";

const envSchema = z.object({
  TZ: z.string().default("Asia/Shanghai"),
  BASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  GITHUB_TOKEN: z.string().optional(),
  FEISHU_WEBHOOK_URL: z.string().url().optional(),
  FEISHU_SECRET: z.string().optional(),
  AUTO_COMMIT_REPORT: z.string().default("true"),
  REPORT_ARTIFACT: z.string().default("true"),
  MAX_ITEMS_PER_SOURCE: z.string().default("30"),
  MAX_ITEMS_FOR_ANALYSIS: z.string().default("10"),
});

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function loadConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: { dryRun?: boolean; rootDir?: string } = {},
): RuntimeConfig {
  const parsed = envSchema.parse(env);
  const maxItemsPerSource = Number.parseInt(parsed.MAX_ITEMS_PER_SOURCE, 10);

  if (!Number.isFinite(maxItemsPerSource) || maxItemsPerSource < 1) {
    throw new Error("MAX_ITEMS_PER_SOURCE must be a positive integer");
  }

  const maxItemsForAnalysis = Number.parseInt(parsed.MAX_ITEMS_FOR_ANALYSIS, 10);
  if (!Number.isFinite(maxItemsForAnalysis) || maxItemsForAnalysis < 1) {
    throw new Error("MAX_ITEMS_FOR_ANALYSIS must be a positive integer");
  }

  return {
    timezone: parsed.TZ,
    baseUrl: parsed.BASE_URL,
    apiKey: parsed.API_KEY,
    aiModel: parsed.AI_MODEL,
    githubToken: parsed.GITHUB_TOKEN,
    feishuWebhookUrl: parsed.FEISHU_WEBHOOK_URL,
    feishuSecret: parsed.FEISHU_SECRET,
    autoCommitReport: parseBoolean(parsed.AUTO_COMMIT_REPORT),
    reportArtifact: parseBoolean(parsed.REPORT_ARTIFACT),
    maxItemsPerSource,
    maxItemsForAnalysis,
    dryRun: options.dryRun ?? false,
    sources: loadSources(options.rootDir),
  };
}
