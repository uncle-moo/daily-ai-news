import { describe, expect, it } from "vitest";
import { getYesterdayWindow } from "../src/time.js";

describe("getYesterdayWindow", () => {
  it("calculates yesterday in Asia/Shanghai from a UTC instant", () => {
    const now = new Date("2026-05-16T14:30:00.000Z");
    const window = getYesterdayWindow(now, "Asia/Shanghai");

    expect(window.labelDate).toBe("2026-05-15");
    expect(window.timezone).toBe("Asia/Shanghai");
    expect(window.start.toISOString()).toBe("2026-05-14T16:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-05-15T15:59:59.999Z");
  });
});
