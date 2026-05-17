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
