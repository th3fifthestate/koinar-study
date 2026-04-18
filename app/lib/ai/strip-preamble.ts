// Strip any conversational preamble the model emits before the first markdown
// heading. Models occasionally lead with "Excellent. Let me compose the study."
// or similar filler despite system-prompt instructions; this is the backstop.
//
// Rule: the study body must begin with an H1 (`# Title`). Anything before the
// first line that starts with `# ` (excluding code fences) is discarded.
// If no H1 is present, the text is returned unchanged so we never lose content.

export function stripPreamble(text: string): { cleaned: string; stripped: string } {
  if (!text) return { cleaned: text, stripped: "" };

  const lines = text.split("\n");
  let inFence = false;
  let headingIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track fenced code blocks so a `#` inside a fence doesn't count.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^#\s+\S/.test(line)) {
      headingIdx = i;
      break;
    }
  }

  if (headingIdx <= 0) {
    return { cleaned: text, stripped: "" };
  }

  // Drop everything before the H1, including common separator lines ("---")
  // that sometimes follow a preamble.
  const stripped = lines.slice(0, headingIdx).join("\n");
  const cleaned = lines.slice(headingIdx).join("\n");
  return { cleaned, stripped };
}
