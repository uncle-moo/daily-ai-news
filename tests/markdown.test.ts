import { describe, expect, it } from "vitest";
import { renderFeishuMarkdown, renderFullReportMarkdown } from "../src/render/markdown.js";

const report = {
  date: "2026-05-15",
  highlights: ["重点变化"],
  news: [
    {
      title: "模型发布",
      summary: "发布了新模型",
      whyImportant: "影响开发者",
      importance: 5,
      sources: ["https://example.com"],
    },
  ],
  repositories: [
    {
      fullName: "acme/tool",
      summary: "AI 工具",
      coreCapabilities: ["RAG"],
      useCases: ["知识库"],
      projectData: "100 stars",
      whyWatch: "增长快",
      url: "https://github.com/acme/tool",
    },
  ],
  rejected: ["无关内容"],
};

const window = {
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

  it("renders empty sections explicitly", () => {
    const markdown = renderFullReportMarkdown({ ...report, highlights: [], news: [], repositories: [], rejected: [] }, window);

    expect(markdown).toContain("## 今日摘要\n\n- 无");
    expect(markdown).toContain("## AI资讯\n\n- 无");
    expect(markdown).toContain("## GitHub仓库/工具\n\n- 无");
    expect(markdown).toContain("## 候选但未入选\n\n- 无");
  });
});
