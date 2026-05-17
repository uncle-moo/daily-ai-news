import "dotenv/config";
import { loadConfigFromEnv } from "./config/env.js";
import { log } from "./log.js";
import { runPipeline } from "./pipeline.js";
import { getYesterdayWindow } from "./time.js";

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
