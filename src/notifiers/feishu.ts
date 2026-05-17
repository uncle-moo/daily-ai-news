import { createHmac } from "node:crypto";
import { log } from "../log.js";

interface SendFeishuMarkdownOptions {
  markdown: string;
  webhookUrl?: string;
  secret?: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
}

export function createFeishuSignature(timestamp: string, secret: string): string {
  return createHmac("sha256", `${timestamp}\n${secret}`).digest("base64");
}

export function chunkMarkdown(markdown: string, maxLength = 3500): string[] {
  if (maxLength < 1) {
    throw new Error("maxLength must be a positive integer");
  }

  if (markdown.length === 0) {
    return [];
  }

  // Split on blank lines to keep paragraphs intact
  const paragraphs = markdown.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const separator = current.length > 0 ? "\n\n" : "";
    const candidate = current + separator + paragraph;

    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      // Flush current chunk if non-empty
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }

      // Paragraph itself exceeds limit — hard-split it
      if (paragraph.length > maxLength) {
        for (let i = 0; i < paragraph.length; i += maxLength) {
          chunks.push(paragraph.slice(i, i + maxLength));
        }
      } else {
        current = paragraph;
      }
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export async function sendFeishuMarkdown({
  markdown,
  webhookUrl,
  secret,
  dryRun,
  fetchImpl = fetch,
}: SendFeishuMarkdownOptions): Promise<void> {
  if (!webhookUrl) {
    log.warn("FEISHU_WEBHOOK_URL is not configured; skipping Feishu notification");
    return;
  }

  if (dryRun) {
    log.info("Dry run enabled; skipping Feishu notification");
    return;
  }

  for (const chunk of chunkMarkdown(markdown)) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload: Record<string, unknown> = {
      msg_type: "interactive",
      card: {
        elements: [{ tag: "markdown", content: chunk }],
      },
    };

    if (secret) {
      payload.timestamp = timestamp;
      payload.sign = createFeishuSignature(timestamp, secret);
    }

    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Feishu notification failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { code?: number; msg?: string };
    if (typeof data.code === "number" && data.code !== 0) {
      throw new Error(`Feishu notification failed: ${data.code} ${data.msg ?? ""}`.trim());
    }
  }
}
