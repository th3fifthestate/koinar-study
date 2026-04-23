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
  const issues = checks.filter((c) => c.status !== "present");

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
    console.warn(
      `[env] Dev startup — missing/short env vars:\n${lines}\n  → See founders-files/runbooks/env-dev-loading.md`,
    );
  }
}
