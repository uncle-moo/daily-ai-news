import { analyzeItems } from "./ai/analyze.js";
import { createCollectorsFromConfig, runCollectors } from "./collectors/index.js";
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
  collectors = createCollectorsFromConfig(config.sources),
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
