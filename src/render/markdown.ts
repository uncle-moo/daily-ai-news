import type { AnalyzedReport, TimeWindow } from "../types.js";

function linkList(urls: string[]): string {
  if (urls.length === 0) {
    return "无";
  }

  return urls.map((url, index) => `[来源${index + 1}](${url})`).join(" ");
}

function listOrNone(items: string[]): string[] {
  return items.length === 0 ? ["- 无"] : items.map((item) => `- ${item}`);
}

function inlineList(items: string[]): string {
  return items.length === 0 ? "无" : items.join("；");
}

export function renderFullReportMarkdown(report: AnalyzedReport, window: TimeWindow): string {
  const lines: string[] = [
    `# AI 日报 ${report.date}`,
    "",
    `> 时间窗口：${window.labelDate} 00:00 - 23:59 ${window.timezone}`,
    "",
    "## 今日摘要",
    "",
    ...listOrNone(report.highlights),
    "",
    "## AI资讯",
    "",
  ];

  if (report.news.length === 0) {
    lines.push("- 无", "");
  } else {
    report.news.forEach((item, index) => {
      lines.push(
        `### ${index + 1}. ${item.title}`,
        `- 摘要：${item.summary}`,
        `- 为什么重要：${item.whyImportant}`,
        `- 重要性：${item.importance}/5`,
        `- 来源：${linkList(item.sources)}`,
        "",
      );
    });
  }

  lines.push("## GitHub仓库/工具", "");
  if (report.repositories.length === 0) {
    lines.push("- 无", "");
  } else {
    report.repositories.forEach((repo, index) => {
      lines.push(
        `### ${index + 1}. ${repo.fullName}`,
        `- 简介：${repo.summary}`,
        `- 核心能力：${inlineList(repo.coreCapabilities)}`,
        `- 适用场景：${inlineList(repo.useCases)}`,
        `- 项目数据：${repo.projectData}`,
        `- 关注理由：${repo.whyWatch}`,
        `- 链接：[GitHub](${repo.url})`,
        "",
      );
    });
  }

  lines.push("## 候选但未入选", "", ...listOrNone(report.rejected));

  return `${lines.join("\n").trim()}\n`;
}

export function renderFeishuMarkdown(report: AnalyzedReport): string {
  const lines: string[] = [
    `# AI 日报 ${report.date}`,
    "",
    "## 今日摘要",
    "",
    ...listOrNone(report.highlights),
    "",
    "## AI资讯",
  ];

  if (report.news.length === 0) {
    lines.push("- 无");
  } else {
    for (const item of report.news) {
      lines.push(`- **${item.title}**：${item.summary} ${linkList(item.sources)}`);
    }
  }

  lines.push("", "## GitHub仓库/工具");
  if (report.repositories.length === 0) {
    lines.push("- 无");
  } else {
    for (const repo of report.repositories) {
      lines.push(`- **${repo.fullName}**：${repo.summary} [GitHub](${repo.url})`);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
