import { describe, it, expect } from "vitest";
import { stripPreamble } from "./strip-preamble";

describe("stripPreamble", () => {
  it("removes conversational preamble before the first H1", () => {
    const input = `Excellent. I now have everything I need. Let me compose the study.

---

# Psalm 1 — The Two Paths

## Introduction

Body here.`;
    const { cleaned, stripped } = stripPreamble(input);
    expect(cleaned.startsWith("# Psalm 1")).toBe(true);
    expect(stripped).toContain("Excellent");
  });

  it("is a no-op when the text starts with the H1", () => {
    const input = `# Title\n\nBody.`;
    const { cleaned, stripped } = stripPreamble(input);
    expect(cleaned).toBe(input);
    expect(stripped).toBe("");
  });

  it("is a no-op when no H1 exists (never loses content)", () => {
    const input = `Some text without a heading.\nMore text.`;
    const { cleaned, stripped } = stripPreamble(input);
    expect(cleaned).toBe(input);
    expect(stripped).toBe("");
  });

  it("ignores `#` lines inside fenced code blocks when locating the H1", () => {
    const input = `Preamble line.

\`\`\`bash
# this is a shell comment, not a heading
\`\`\`

# Real Title

Body.`;
    const { cleaned } = stripPreamble(input);
    expect(cleaned.startsWith("# Real Title")).toBe(true);
  });

  it("handles empty input safely", () => {
    const { cleaned, stripped } = stripPreamble("");
    expect(cleaned).toBe("");
    expect(stripped).toBe("");
  });
});
