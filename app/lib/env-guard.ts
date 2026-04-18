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

function inspect(name: string): VarStatus {
  const val = process.env[name];
  if (!val) return "empty";
  if (val.length < 10) return "short";
  return "present";
}

export function assertEnvPresence(): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "test") return;

  const isProduction = nodeEnv === "production";
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  const checks = RUNTIME_REQUIRED.map((name) => ({ name, status: inspect(name) }));
  const issues = checks.filter((c) => c.status !== "present");

  if (isProduction && !isBuildPhase) {
    if (issues.length === 0) return;
    const lines = issues.map((c) => `  ${c.name}: ${c.status}`).join("\n");
    throw new Error(`[env] Missing or invalid env vars in production:\n${lines}`);
  }

  // Development: grouped warning (non-fatal)
  if (issues.length > 0) {
    console.group("[env] Dev startup — missing/short env vars:");
    for (const { name, status } of issues) {
      console.warn(`  ${name}: ${status}`);
    }
    console.warn("  → See founders-files/runbooks/env-dev-loading.md");
    console.groupEnd();
  }
}
