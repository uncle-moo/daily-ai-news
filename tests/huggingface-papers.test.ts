import { describe, expect, it } from "vitest";
import { normalizeHFPaper } from "../src/collectors/huggingface-papers.js";

const SAMPLE_PAPER = {
  publishedAt: "2026-05-15T00:00:00.000Z",
  title: "Attention Is All You Need Redux",
  summary: "A new take on transformers.",
  paper: {
    id: "2605.12345",
    title: "Attention Is All You Need Redux",
    summary: "A new take on transformers.",
    ai_summary: "Improved transformer architecture with better efficiency.",
    publishedAt: "2026-05-14T00:00:00.000Z",
    authors: [{ name: "Alice Smith" }, { name: "Bob Jones" }],
    upvotes: 42,
    ai_keywords: ["transformer", "attention", "efficiency"],
  },
};

describe("normalizeHFPaper", () => {
  it("produces a valid NormalizedItem", () => {
    const item = normalizeHFPaper(SAMPLE_PAPER);

    expect(item.id).toBe("hf-paper:2605.12345");
    expect(item.sourceType).toBe("hugging-face");
    expect(item.source).toBe("Hugging Face Papers");
    expect(item.url).toBe("https://huggingface.co/papers/2605.12345");
    expect(item.title).toBe("Attention Is All You Need Redux");
  });

  it("prefers ai_summary over raw summary", () => {
    const item = normalizeHFPaper(SAMPLE_PAPER);
    expect(item.summary).toBe("Improved transformer architecture with better efficiency.");
  });

  it("maps authors correctly", () => {
    const item = normalizeHFPaper(SAMPLE_PAPER);
    expect(item.authors).toEqual(["Alice Smith", "Bob Jones"]);
  });

  it("uses ai_keywords as tags", () => {
    const item = normalizeHFPaper(SAMPLE_PAPER);
    expect(item.tags).toContain("transformer");
  });

  it("falls back to raw summary when ai_summary is absent", () => {
    const paper = {
      ...SAMPLE_PAPER,
      paper: { ...SAMPLE_PAPER.paper, ai_summary: undefined },
    };
    const item = normalizeHFPaper(paper);
    expect(item.summary).toBe("A new take on transformers.");
  });
});
