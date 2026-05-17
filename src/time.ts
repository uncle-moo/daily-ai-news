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
