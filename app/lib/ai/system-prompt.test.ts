// app/lib/ai/system-prompt.test.ts
//
// Regression tests for the system prompt rewrite (Phase 1 of the
// study-generation structure pass). The goal here is NOT to lock the prompt
// down character-for-character — that would make every wording tweak require
// a snapshot update. The goal is to assert the *load-bearing structural
// invariants* that the rest of the pipeline depends on:
//
//   1. The Quick tier carries the hard safety rules (no counsel, no
//      personal application, no second-person imperative). These are the
//      product-safety floor; if they ever silently disappear, fresh Quick
//      generations could start dispensing spiritual guidance and we'd never
//      know until users complained.
//   2. Standard and Comprehensive prescribe a rigid skeleton — the four
//      Scripture References, per-section sub-blocks, etc. Without these,
//      `route.ts` post-processing parses a different shape than what's
//      emitted, and the reader's auto-ToC degrades.
//   3. All three tiers retain the 7-step research protocol. Quick is
//      intentionally short on OUTPUT but full-depth on RESEARCH; we caught
//      this in review and it's the kind of thing that drifts.
//   4. The `study_type` and `verification-audit` fences are required —
//      route.ts depends on both for persistence and admin audit.

import { describe, it, expect } from "vitest";
import { getSystemPrompt } from "./system-prompt";

describe("getSystemPrompt — structural invariants across tiers", () => {
  it.each(["quick", "standard", "comprehensive"] as const)(
    "%s tier retains the 7-step contextual protocol",
    (tier) => {
      const prompt = getSystemPrompt(tier);
      // The protocol is the system-wide research floor. Even Quick — which
      // is brief in OUTPUT — must perform full-depth research per scripture.
      expect(prompt).toMatch(/Step 1:\s*Immediate Context/);
      expect(prompt).toMatch(/Step 2:\s*Chapter Context/);
      expect(prompt).toMatch(/Step 3:\s*Book Context/);
      expect(prompt).toMatch(/Step 4:\s*Cross-References/);
      expect(prompt).toMatch(/Step 5:\s*Original Language/);
      expect(prompt).toMatch(/Step 6:\s*Historical/);
      expect(prompt).toMatch(/Step 7:\s*Canonical/);
    },
  );

  it.each(["quick", "standard", "comprehensive"] as const)(
    "%s tier requires the json-metadata + verification-audit fences (route.ts depends on both)",
    (tier) => {
      const prompt = getSystemPrompt(tier);
      expect(prompt).toContain("json-metadata");
      expect(prompt).toContain("verification-audit");
      // study_type must be present in the metadata schema so the LLM emits
      // it for route.ts to persist into studies.study_type.
      expect(prompt).toContain("study_type");
    },
  );

  it("falls back to comprehensive for unknown format strings", () => {
    // Defensive: a typo or stale enum somewhere upstream shouldn't blow up
    // — the prompt loader returns the comprehensive tier as a safe default.
    const fallback = getSystemPrompt("nonsense-format");
    const comprehensive = getSystemPrompt("comprehensive");
    expect(fallback).toBe(comprehensive);
  });
});

describe("getSystemPrompt — Quick safety guardrails", () => {
  // Quick is the only tier that responds to bare questions. It must NEVER
  // give counsel — the product is "scripture-finder," not "AI pastor."
  // These tests check that the safety scaffolding is present in the system
  // prompt itself; the runtime guardrail (asserting Quick *outputs* don't
  // contain forbidden phrasings) lives in the live-generation evals.
  it("explicitly forbids second-person imperative pastoral phrasing", () => {
    const prompt = getSystemPrompt("quick");
    // The list of forbidden phrasings should at minimum mention these
    // signature pastoral-counsel openers. If we relax these, fresh Quick
    // generations may start emitting "You should…" / "Remember that God…"
    // which is exactly the failure mode users would not tolerate.
    expect(prompt).toMatch(/You should/);
    expect(prompt).toMatch(/Remember that God/);
    expect(prompt).toMatch(/second-person imperative/);
  });

  it("requires the literal 'Read these in context' closer", () => {
    // The closing section is the safety-floor pattern: bare reference list,
    // no reflection / moral / takeaway. The literal heading is what makes
    // this enforceable in review — anything else is too fuzzy to catch.
    const prompt = getSystemPrompt("quick");
    expect(prompt).toContain("Read these in context");
  });

  it("forbids personal application — pastoral interpretation is out of scope", () => {
    const prompt = getSystemPrompt("quick");
    expect(prompt).toMatch(/personal application/i);
  });
});

describe("getSystemPrompt — Standard tier rigid skeleton", () => {
  it("mandates the four-item Scripture References block", () => {
    const prompt = getSystemPrompt("standard");
    // Each of the four labels is what route.ts and the reader rely on for
    // the rendered Scripture References block. If any one is missing from
    // the prompt, generations will under-deliver and the reader's auto-ToC
    // will skip the section.
    expect(prompt).toContain("Primary Text");
    expect(prompt).toContain("Preceding Context");
    expect(prompt).toContain("Following Context");
    expect(prompt).toContain("Broader Context");
  });

  it("requires per-section sub-blocks: Text / Historical / Greek-Hebrew / Cross-Refs", () => {
    const prompt = getSystemPrompt("standard");
    expect(prompt).toContain("Historical Context");
    expect(prompt).toMatch(/Greek\/Hebrew Word Study|Greek\/Hebrew/);
    expect(prompt).toMatch(/Cross-References|Cross-Refs/);
  });

  it("includes type-aware body section naming for all five study types", () => {
    const prompt = getSystemPrompt("standard");
    // The 5 study skeletons — passage / person / word / topical / book —
    // each have their own body-section header convention. The prompt must
    // describe all five so the LLM picks the correct one based on its
    // type detection.
    expect(prompt.toLowerCase()).toContain("passage");
    expect(prompt.toLowerCase()).toContain("person");
    expect(prompt.toLowerCase()).toContain("topical");
    expect(prompt.toLowerCase()).toContain("book");
    expect(prompt.toLowerCase()).toContain("word");
  });
});

describe("getSystemPrompt — Comprehensive tier extensions", () => {
  it("adds Book/Domain Context and Preceding Context as front matter", () => {
    const prompt = getSystemPrompt("comprehensive");
    // Comprehensive sits the body inside an arc: front matter (book/domain
    // context, preceding context) → body sections → back matter (following
    // context, legacy table). This is what differentiates it from Standard.
    expect(prompt).toMatch(/Book.*Context|Domain Context/);
    expect(prompt).toContain("Preceding Context");
  });

  it("adds Following Context and a legacy/echoes table as back matter", () => {
    const prompt = getSystemPrompt("comprehensive");
    expect(prompt).toContain("Following Context");
    expect(prompt).toMatch(/Legacy|Echoes/);
  });

  it("describes verse-block subdivision inside each body section", () => {
    const prompt = getSystemPrompt("comprehensive");
    // Verse-block subdivision (Verses X-Y / Episode N.M / Sense N.M / etc.)
    // is the depth-marker. If the prompt drops it, Comprehensive collapses
    // to Standard's structure with a higher word count.
    expect(prompt).toMatch(/Verses X.Y|verse-block|Verse-block/i);
  });

  it("targets a 4,500–6,000 word range (raised from 5,000)", () => {
    const prompt = getSystemPrompt("comprehensive");
    // The 6,000 ceiling is intentional — see plan note about trimming Greek
    // word-study density to fit. If the upper bound regresses to 5,000, the
    // tier will under-deliver vs. the Acts-15 PDF reference.
    expect(prompt).toMatch(/6,000|6000/);
  });
});
