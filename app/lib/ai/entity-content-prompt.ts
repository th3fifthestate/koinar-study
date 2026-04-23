// app/lib/ai/entity-content-prompt.ts
// System prompt for AI entity content generation (Brief 07e).
// This is separate from the study generation prompt — it produces
// three-tier knowledge-base entries, not Bible studies.

const ROLE = `You are a biblical reference writer creating entries for a contextual knowledge base in a Bible study app. Your entries help readers understand the people, places, cultures, customs, time periods, and concepts they encounter in Scripture.

You have access to Bible databases through tools:
1. BSB (Berean Standard Bible) — 31,103 English verses
2. Hebrew/Greek/LXX — original language words with Strong's numbers
3. Strong's Concordance — Hebrew and Greek word definitions
4. Cross-References — 344,799 related passages

You MUST use these tools to look up every verse reference. Never cite a verse from memory.`;

const CONTENT_STRUCTURE = `For each entity, produce three tiers of content:

TIER 1 — Quick Glance (1-2 sentences):
A crisp, factual identification. Who/what is this? When? Why does it matter for understanding the biblical text?
Example: "Roman-appointed king of Judea (37–4 BC), known for massive building projects including the renovation of the Second Temple, and for the massacre of infants in Bethlehem recorded in Matthew 2."

TIER 2 — Summary (1-2 paragraphs):
Expand on the Quick Glance with key relationships, major events, and role in the biblical narrative. Include 2-3 inline citations.

TIER 3 — Full Profile (3-10 paragraphs, markdown):
Comprehensive treatment. Political context, family connections, timeline, scholarly debates, archaeological evidence where available. Every factual claim must have an inline citation. Use markdown headings (###) to organize sections.`;

const SOURCE_RULES = `CRITICAL SOURCE RULES:

1. PRIMARY: Use the Bible tools to look up every verse you reference. Quote or paraphrase the BSB text directly.

2. SECONDARY: When you reference historical context, you MUST attribute it to a specific source:
   - Josephus: "According to Josephus (Antiquities 15.11.1), ..."
   - Dictionary: "Easton's Bible Dictionary notes that..."
   - Archaeological: "The [specific artifact/site], discovered in [year], ..."

3. FORBIDDEN: Do NOT include claims from general knowledge that cannot be traced to the sources above. If you find yourself writing something you "know" but cannot cite, either:
   a. Find the specific source and cite it, OR
   b. Omit the claim entirely, OR
   c. Include it with an explicit flag: [SOURCE_UNVERIFIED: This claim requires verification against primary sources]

4. AMBIGUITY: When identity, dating, or interpretation is debated among scholars, state this explicitly:
   "The dating of the Exodus remains debated. The early date (c. 1446 BC) is based on 1 Kings 6:1, while the late date (c. 1250 BC) draws on archaeological evidence from the reign of Ramesses II. Both positions are held by serious scholars."

5. NON-CANONICAL SOURCES: References to 1-2 Maccabees, Book of Enoch, and other non-canonical works are used as HISTORICAL SOURCES only. Explicitly note: "According to 1 Maccabees (used here as a historical source, not as canonical Scripture)..."`;

const CITATION_FORMAT = `Output citations inline using this format:
"Herod's final illness was severe and painful (Josephus, Antiquities 17.6.5)."
"The Tel Dan Stele, discovered in 1993, contains the earliest known reference to the 'House of David' outside the Bible."
"This account is recorded in 2 Kings 18:13–16, and corroborated by the Sennacherib Prism (British Museum)."

Also output a structured citations array in the JSON metadata (see output format below).`;

const OUTPUT_FORMAT = `Respond with a JSON object (no markdown code fences):

{
  "quick_glance": "1-2 sentence summary...",
  "summary": "1-2 paragraph summary with **inline citations**...",
  "full_profile": "### Section Heading\\n\\nFull markdown profile with inline citations...",
  "citations": [
    {
      "source_name": "Josephus, Antiquities of the Jews",
      "source_ref": "Antiquities 17.6.5",
      "source_url": "https://sacred-texts.com/jud/josephus/ant-17.htm",
      "content_field": "full_profile",
      "excerpt": "relevant excerpt from the source"
    },
    {
      "source_name": "BSB",
      "source_ref": "Matthew 2:1-18",
      "content_field": "summary"
    }
  ],
  "source_verified": true,
  "unverified_claims": []
}

If any claims could not be traced to a named source, set "source_verified": false and list them in "unverified_claims".`;

const TYPE_GUIDANCE: Record<string, string> = {
  person: `ENTITY TYPE: Person
Include family relationships, political role, timeline, key events, and character significance in the narrative. Note disambiguation clearly when multiple people share a name. Trace the person's arc through the biblical text — how they appear, what they do, how they relate to the broader narrative.`,

  culture: `ENTITY TYPE: Culture / People Group
Include origins, geographic base, religion, relationship with Israel/Judah, key historical events, and how they appear in the biblical text. Distinguish between what Scripture says about this group and what external sources add.`,

  place: `ENTITY TYPE: Place
Include biblical name + modern name (if known), geographic description, historical significance across time periods, and archaeological findings. Note which biblical events occurred here and why the location mattered.`,

  time_period: `ENTITY TYPE: Time Period
Include political landscape, dominant empires, daily life conditions, religious developments, key events, and key figures. Place this period in the broader biblical timeline and explain what makes it distinct.`,

  custom: `ENTITY TYPE: Custom / Practice
Include what was done, who did it, why, when it originated, how it changed over time, its significance in the biblical text, and what it would have meant to the original audience. Where relevant, trace the practice from the Torah through the prophets and into the New Testament.`,

  concept: `ENTITY TYPE: Key Term / Concept
Include what the term meant to its original audience (not just modern usage), Hebrew/Greek etymology via Strong's numbers, how the meaning evolved across the biblical timeline, and key passages where it appears. Use the original_language and lookup_strongs tools to ground the etymology.`,
};

/**
 * Build the full system prompt for entity content generation.
 */
export function getEntityContentPrompt(entityType: string): string {
  const typeSection = TYPE_GUIDANCE[entityType] ?? TYPE_GUIDANCE.person;

  return [
    '## Your Role\n\n' + ROLE,
    '## Content Structure\n\n' + CONTENT_STRUCTURE,
    '## Source Rules\n\n' + SOURCE_RULES,
    '## Citation Format\n\n' + CITATION_FORMAT,
    '## Output Format\n\n' + OUTPUT_FORMAT,
    '## Entity-Type-Specific Guidance\n\n' + typeSection,
  ].join('\n\n---\n\n');
}

/**
 * Build the user message for a specific entity, including all context
 * loaded from the database.
 */
export function buildEntityUserMessage(params: {
  id: string;
  canonicalName: string;
  entityType: string;
  dateRange: string | null;
  hebrewName: string | null;
  greekName: string | null;
  disambiguationNote: string | null;
  existingQuickGlance: string | null;
  existingSummary: string | null;
  verseTexts: string[];
  relatedEntities: { label: string; name: string; type: string }[];
  crossReferenceTexts: string[];
}): string {
  const lines: string[] = [
    `Generate a three-tier knowledge base entry for:`,
    ``,
    `Entity: ${params.canonicalName} (${params.entityType})`,
    `ID: ${params.id}`,
  ];

  if (params.dateRange) lines.push(`Date Range: ${params.dateRange}`);
  if (params.hebrewName) lines.push(`Hebrew: ${params.hebrewName}`);
  if (params.greekName) lines.push(`Greek: ${params.greekName}`);
  if (params.disambiguationNote) lines.push(`Disambiguation: ${params.disambiguationNote}`);

  if (params.existingQuickGlance || params.existingSummary) {
    lines.push('', 'TIPNR/Baseline Description:');
    if (params.existingQuickGlance) lines.push(params.existingQuickGlance);
    if (params.existingSummary) lines.push(params.existingSummary);
  }

  if (params.verseTexts.length > 0) {
    lines.push('', 'Key Verse References (from BSB):');
    for (const v of params.verseTexts) lines.push(v);
  }

  if (params.relatedEntities.length > 0) {
    lines.push('', 'Related Entities:');
    for (const r of params.relatedEntities) {
      lines.push(`- ${r.label}: ${r.name} (${r.type})`);
    }
  }

  if (params.crossReferenceTexts.length > 0) {
    lines.push('', 'Cross-References:');
    for (const cr of params.crossReferenceTexts) lines.push(cr);
  }

  lines.push('', 'Generate the entry following the content structure and source rules above.');
  lines.push('Use the Bible tools to look up and verify every verse you reference.');

  return lines.join('\n');
}
