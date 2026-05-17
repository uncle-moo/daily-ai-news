import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { chunkMarkdown, createFeishuSignature, sendFeishuMarkdown } from "../src/notifiers/feishu.js";

describe("createFeishuSignature", () => {
  it("matches Feishu HMAC-SHA256 signing format", () => {
    const timestamp = "1715750400";
    const secret = "secret";
    const expected = createHmac("sha256", `${timestamp}\n${secret}`).digest("base64");

    expect(createFeishuSignature(timestamp, secret)).toBe(expected);
  });
});

describe("chunkMarkdown", () => {
  it("returns single chunk when content fits", () => {
    expect(chunkMarkdown("hello world", 100)).toEqual(["hello world"]);
  });

  it("keeps paragraphs intact across chunks", () => {
    const md = "paragraph one\n\nparagraph two\n\nparagraph three";
    const chunks = chunkMarkdown(md, 30);

    // Each chunk must not exceed maxLength
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30);
    }
    // Reassembled content must equal original
    expect(chunks.join("\n\n")).toBe(md);
  });

  it("hard-splits a single paragraph that exceeds maxLength", () => {
    const chunks = chunkMarkdown("a".repeat(12), 5);

    expect(chunks).toEqual(["aaaaa", "aaaaa", "aa"]);
  });

  it("sends two chunks when content spans two pages", async () => {
    const para = "x".repeat(2000);
    const md = `${para}\n\n${para}`;
    const chunks = chunkMarkdown(md, 3500);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(para);
    expect(chunks[1]).toBe(para);
  });

  it("returns empty array for empty input", () => {
    expect(chunkMarkdown("", 100)).toEqual([]);
  });

  it("rejects invalid max length", () => {
    expect(() => chunkMarkdown("content", 0)).toThrow(/maxLength/);
  });
});

describe("sendFeishuMarkdown", () => {
  it("does not send during dry run", async () => {
    const fetchMock = vi.fn();

    await sendFeishuMarkdown({
      markdown: "# Report",
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test",
      dryRun: true,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends every markdown chunk", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0 }),
    });

    await sendFeishuMarkdown({
      markdown: "a".repeat(3501),
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test",
      dryRun: false,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on Feishu business errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 19001, msg: "invalid sign" }),
    });

    await expect(
      sendFeishuMarkdown({
        markdown: "# Report",
        webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test",
        dryRun: false,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/19001/);
  });
});
