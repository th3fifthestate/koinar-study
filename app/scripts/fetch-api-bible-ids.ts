// app/scripts/fetch-api-bible-ids.ts
//
// One-shot helper: list the Bible IDs (UUIDs) for the three api.bible
// translations Koinar uses (NLT, NIV, NASB 1995). Run once after signing
// up / receiving access, paste the output into `.env`.
//
// Why: `API_BIBLE_KEY` authenticates all three translations on the Starter
// plan — one key, many Bibles. But each translation has its own UUID
// (`/v1/bibles/{id}/passages/...`) and the app config needs those UUIDs
// separately. Without them, `getAvailableTranslations()` hides NLT/NIV/NASB
// and the reader's translation switcher only offers BSB, which presents as
// "translations don't appear when I switch."
//
// Usage:
//   npx tsx scripts/fetch-api-bible-ids.ts
//
// Exits 0 on success; 1 on auth failure, network error, or if any of the
// three target translations is not present in the authorized catalog.

import { config } from "@/lib/config";

const API_BASE = "https://rest.api.bible/v1";

// Abbreviations or unique name fragments to search for. api.bible returns
// a `name` and an `abbreviation` per Bible; we match case-insensitively on
// either. The NASB 1995 appears under various short forms — match the year
// to disambiguate from NASB 2020 (not in our license).
const TARGETS = [
  { key: "API_BIBLE_ID_NLT", matchAbbr: ["NLT"], matchName: ["new living translation"] },
  { key: "API_BIBLE_ID_NIV", matchAbbr: ["NIV"], matchName: ["new international version"] },
  { key: "API_BIBLE_ID_NASB", matchAbbr: ["NASB", "NASB1995"], matchName: ["new american standard bible 1995", "new american standard bible (1995)"] },
] as const;

interface BibleRow {
  id: string;
  abbreviation: string;
  abbreviationLocal?: string;
  name: string;
  nameLocal?: string;
  language?: { id: string; name: string };
}

async function main(): Promise<void> {
  const key = config.bible.apiBibleKey;
  if (!key) {
    console.error("[fetch-api-bible-ids] API_BIBLE_KEY is not set in .env — add it first, then re-run.");
    process.exit(1);
  }

  const url = `${API_BASE}/bibles?language=eng`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "api-key": key, accept: "application/json" } });
  } catch (err) {
    console.error("[fetch-api-bible-ids] network error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[fetch-api-bible-ids] ${res.status} from api.bible: ${body.slice(0, 300)}`);
    if (res.status === 401 || res.status === 403) {
      console.error("  → Check API_BIBLE_KEY is valid and that NLT/NIV/NASB are approved on your plan.");
    }
    process.exit(1);
  }

  const payload = (await res.json()) as { data?: BibleRow[] };
  const rows = payload.data ?? [];
  if (!rows.length) {
    console.error("[fetch-api-bible-ids] api.bible returned 0 Bibles — license may not be active yet.");
    process.exit(1);
  }

  console.log(`\napi.bible returned ${rows.length} authorized English Bible(s).\n`);

  const resolved: Array<{ key: string; id: string; label: string }> = [];
  const missing: string[] = [];

  for (const target of TARGETS) {
    const matches = rows.filter((row) => {
      const abbr = [row.abbreviation, row.abbreviationLocal].filter(Boolean).map((s) => s!.toLowerCase());
      const name = [row.name, row.nameLocal].filter(Boolean).map((s) => s!.toLowerCase());
      const abbrHit = target.matchAbbr.some((m) => abbr.includes(m.toLowerCase()));
      const nameHit = target.matchName.some((m) => name.some((n) => n.includes(m.toLowerCase())));
      return abbrHit || nameHit;
    });

    if (matches.length === 0) {
      missing.push(target.key);
      continue;
    }

    // Prefer exact-abbreviation match when there's more than one candidate.
    const best =
      matches.find((m) =>
        target.matchAbbr.some((a) => m.abbreviation?.toLowerCase() === a.toLowerCase()),
      ) ?? matches[0];

    resolved.push({
      key: target.key,
      id: best.id,
      label: `${best.abbreviation} — ${best.name}`,
    });
  }

  if (resolved.length) {
    console.log("Paste these into your .env file:");
    console.log("");
    for (const r of resolved) {
      console.log(`${r.key}=${r.id}   # ${r.label}`);
    }
    console.log("");
  }

  if (missing.length) {
    console.error(
      `[fetch-api-bible-ids] Could not resolve: ${missing.join(", ")}.\n` +
        "  → Your api.bible plan may not include these translations yet.\n" +
        "  → Contact support@api.bible to request access, or remove them from the target list.",
    );
    process.exit(1);
  }

  console.log("All three translation IDs resolved. Restart the dev server after updating .env.");
}

main().catch((err) => {
  console.error("[fetch-api-bible-ids] unexpected error:", err);
  process.exit(1);
});
