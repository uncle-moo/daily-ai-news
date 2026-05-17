import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeReport(date: string, markdown: string, rootDir = process.cwd()): Promise<string> {
  const reportsDir = join(rootDir, "reports");
  await mkdir(reportsDir, { recursive: true });

  const reportPath = join(reportsDir, `${date}.md`);
  await writeFile(reportPath, markdown, "utf8");

  return reportPath;
}
