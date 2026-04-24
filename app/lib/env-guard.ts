// Brief 24: startup diagnostics for runtime-required env vars
const RUNTIME_REQUIRED = [
  "ANTHROPIC_API_KEY",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
  "API_BIBLE_KEY",
  "RESEND_API_KEY",
  "RESEND_AUDIENCE_ID",
  "FLUX_API_KEY",
  "DATABASE_PATH",
  "BIBLE_DB_PATH",
] as const;

// Paired-requirement: if API_BIBLE_KEY is set, these per-translation Bible IDs
// must also be set. Otherwise getAvailableTranslations() silently hides NLT/
// NIV/NASB in the reader and the translation switcher just shows BSB — which
// presents as "translations don't appear when I switch." Fetch the IDs via
// `npx tsx scripts/fetch-api-bible-ids.ts`.
const API_BIBLE_TRANSLATION_IDS = [
  "API_BIBLE_ID_NLT",
  "API_BIBLE_ID_NIV",
  "API_BIBLE_ID_NASB",
] as const;

// FUMS_UID_SALT is paired with API_BIBLE_KEY: once we're making licensed
// fetches, we need a stable salt to hash user IDs before reporting them to
// the FUMS endpoint. Missing salt means the cron falls back to sending no
// uId, which works but reduces api.bible's visibility into our usage pattern.
// Warn in dev, require in prod (production schema already enforces min 32).
const API_BIBLE_FUMS_DEPENDENCIES = ["FUMS_UID_SALT"] as const;

type VarStatus = "present" | "empty" | "short";

// Inspect the parsed env when provided so zod defaults count as "present"
// (e.g., DATABASE_PATH/BIBLE_DB_PATH have defaults that don't appear in
// process.env). Fall back to process.env for names not in the parsed object.
function inspect(name: string, parsed?: Record<string, unknown>): VarStatus {
  const raw = parsed && name in parsed ? parsed[name] : process.env[name];
  const val = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  if (!val) return "empty";
  if (val.length < 10) return "short";
  return "present";
}

export function assertEnvPresence(parsed?: Record<string, unknown>): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "test") return;

  // Browsers never have server-only env vars. If this guard runs in a client
  // bundle (via a transitive import from a 'use client' component that pulls
  // in @/lib/config), bail out — the actual server process enforces presence
  // at startup.
  if (typeof window !== "undefined") return;

  const isProduction = nodeEnv === "production";
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  const checks = RUNTIME_REQUIRED.map((name) => ({ name, status: inspect(name, parsed) }));
  // Widen to plain string so paired-requirement checks below can push in names
  // from API_BIBLE_TRANSLATION_IDS / API_BIBLE_FUMS_DEPENDENCIES without a type
  // error (they're not part of RUNTIME_REQUIRED's literal union).
  const issues: Array<{ name: string; status: VarStatus }> = checks.filter(
    (c) => c.status !== "present",
  );

  // Paired API.Bible check — only flag the IDs when the API key itself is
  // configured. A blank API.Bible stack (key + IDs all empty) is a valid
  // dev posture for someone not using licensed translations; a half-configured
  // stack (key set, IDs empty) is always a bug.
  const apiKeyStatus = inspect("API_BIBLE_KEY", parsed);
  if (apiKeyStatus === "present") {
    for (const name of API_BIBLE_TRANSLATION_IDS) {
      const status = inspect(name, parsed);
      if (status !== "present") {
        issues.push({ name, status });
      }
    }
    for (const name of API_BIBLE_FUMS_DEPENDENCIES) {
      const status = inspect(name, parsed);
      if (status !== "present") {
        issues.push({ name, status });
      }
    }
  }

  if (isProduction && !isBuildPhase) {
    if (issues.length === 0) return;
    const lines = issues.map((c) => `  ${c.name}: ${c.status}`).join("\n");
    throw new Error(`[env] Missing or invalid env vars in production:\n${lines}`);
  }

  // Development: grouped warning (non-fatal).
  // Avoid console.group / console.groupEnd — unsupported in Next's edge runtime
  // where this module is loaded via lib/env.ts → lib/config.ts import chains.
  if (issues.length > 0) {
    const lines = issues.map((c) => `  ${c.name}: ${c.status}`).join("\n");
    const hint = issues.some((c) => API_BIBLE_TRANSLATION_IDS.includes(c.name as typeof API_BIBLE_TRANSLATION_IDS[number]))
      ? "\n  → Run `npx tsx scripts/fetch-api-bible-ids.ts` to fetch IDs, then paste into .env."
      : "";
    console.warn(
      `[env] Dev startup — missing/short env vars:\n${lines}\n  → See founders-files/runbooks/env-dev-loading.md${hint}`,
    );
  }
}
