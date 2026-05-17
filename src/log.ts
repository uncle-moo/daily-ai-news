const secretPatterns = [
  /xoxb-[A-Za-z0-9-]+/g,
  /https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9-]+/g,
];

function redact(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
}

export const log = {
  info(message: string, meta?: unknown): void {
    console.log(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
  warn(message: string, meta?: unknown): void {
    console.warn(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
  error(message: string, meta?: unknown): void {
    console.error(message, meta === undefined ? "" : redact(JSON.stringify(meta)));
  },
};
