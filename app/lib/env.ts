import { z } from "zod";
import { assertEnvPresence } from "./env-guard";

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------
// This module validates all environment variables at import time.
// In production (at runtime), missing required variables cause a hard failure.
// During `next build` and in development, missing variables fall back to
// empty/default values so the build succeeds without secrets present.
//
// Usage: import { env } from "@/lib/env";
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === "production";
// During `next build`, Next.js sets NODE_ENV=production but secrets are not
// present — skip hard validation so the build succeeds.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
// If this module is evaluated in a browser bundle (via some transitive import
// from a client component — e.g. components/shared/useCopyCap pulling in
// `@/lib/config`), `process.env` is an empty object at runtime and strict
// validation would throw on page load. Server-only env vars (SESSION_SECRET,
// ANTHROPIC_API_KEY, etc.) must NEVER be present in the client bundle anyway,
// so skipping the strict gate here is the correct behavior — the actual
// server process still enforces it at startup.
const isBrowser = typeof window !== "undefined";
// Treat build-time and browser-runtime as non-strict even when NODE_ENV=production.
const strictValidation = isProduction && !isBuildPhase && !isBrowser;

// --- Lenient schema (always parses with defaults) ---
// Used to extract values. Strict checks are done separately below.

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_PATH: z.string().default("./data/app.db"),
  BIBLE_DB_PATH: z.string().default("./data/databases"),

  // Auth
  SESSION_SECRET: z.string().default(""),

  // AI
  ANTHROPIC_API_KEY: z.string().default(""),
  AI_MODEL_ID: z.string().default("claude-opus-4-6"),

  // Email
  RESEND_API_KEY: z.string().default(""),
  RESEND_AUDIENCE_ID: z.string().default(""),

  // Bible APIs
  ESV_API_KEY: z.string().default(""),
  API_BIBLE_KEY: z.string().default(""),
  API_BIBLE_ID_NLT: z.string().default(""),
  API_BIBLE_ID_NIV: z.string().default(""),
  API_BIBLE_ID_NASB: z.string().default(""),
  // Salt for sha256(userId + salt) before sending uId to FUMS. Must be stable
  // for the life of the deployment — rotating it breaks api.bible's view of
  // user-session continuity. Generate once (`openssl rand -hex 32`) and never
  // change. Absence just drops the uId query param — FUMS spec makes uId optional.
  FUMS_UID_SALT: z.string().default(""),
  // ABS termination kill-switch — when true, getAvailableTranslations() hides
  // every licensed translation. Operational flag; see runbooks/abs-termination-purge.md.
  ABS_PURGE_ENABLED: z
    .string()
    .default("")
    .transform((v) => v === "true"),

  // Image generation
  FLUX_API_KEY: z.string().default(""),

  // Cloudflare R2 — image bucket
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET_NAME: z.string().default("koinar-images"),
  R2_PUBLIC_URL: z.string().default("images.koinar.app"),

  // Cloudflare R2 — data bucket (Bible DBs, large infrastructure assets that
  // change rarely). Separate credentials so an image-bucket leak doesn't
  // grant access to the data bucket.
  R2_DATA_ACCOUNT_ID: z.string().default(""),
  R2_DATA_ACCESS_KEY_ID: z.string().default(""),
  R2_DATA_SECRET_ACCESS_KEY: z.string().default(""),
  R2_DATA_BUCKET: z.string().default("koinar-data"),

  // Encryption
  ENCRYPTION_KEY: z.string().default(""),
});

// --- Strict production schema (validated separately at runtime) ---

const productionSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().startsWith("https://", "Must use HTTPS in production"),
  SESSION_SECRET: z.string().min(64, "SESSION_SECRET must be at least 64 characters (32 bytes hex) in production"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required in production"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required in production"),
  RESEND_AUDIENCE_ID: z.string().min(1, "RESEND_AUDIENCE_ID is required in production"),
  FLUX_API_KEY: z.string().min(1, "FLUX_API_KEY is required in production"),
  ENCRYPTION_KEY: z.string().min(64, "ENCRYPTION_KEY must be at least 64 characters in production"),
  API_BIBLE_KEY: z.string().min(1, "API_BIBLE_KEY is required in production"),
  // API_BIBLE_KEY authorizes the translations; each translation still needs its
  // own Bible UUID for the /v1/bibles/{id}/passages URL. A half-configured stack
  // (key set, IDs empty) leaves getAvailableTranslations() returning only BSB —
  // the exact "translations don't appear when I switch" failure mode. Require
  // all three in production so we never ship that state again. Run
  // `npx tsx scripts/fetch-api-bible-ids.ts` locally to resolve UUIDs.
  API_BIBLE_ID_NLT: z.string().min(1, "API_BIBLE_ID_NLT is required in production (paired with API_BIBLE_KEY)"),
  API_BIBLE_ID_NIV: z.string().min(1, "API_BIBLE_ID_NIV is required in production (paired with API_BIBLE_KEY)"),
  API_BIBLE_ID_NASB: z.string().min(1, "API_BIBLE_ID_NASB is required in production (paired with API_BIBLE_KEY)"),
  // FUMS uId is technically optional per api.bible's spec, but running without
  // it means we can't prove continuity of a user's verse-fetch pattern to
  // api.bible during a compliance inquiry. Require it in prod; 32-char min to
  // force at least 128 bits of entropy.
  FUMS_UID_SALT: z.string().min(32, "FUMS_UID_SALT must be at least 32 characters in production (generate via `openssl rand -hex 32`)"),
});

// --- Parse (always succeeds — uses defaults for missing values) ---

const parsed = envSchema.parse(process.env);

// --- Strict validation in production at runtime ---

if (strictValidation) {
  const strictParsed = productionSchema.safeParse(process.env);
  if (!strictParsed.success) {
    const errors = strictParsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    const message = `\n[env] Missing or invalid environment variables in production:\n${errors}\n`;
    console.error(message);
    throw new Error(message);
  }
} else if (isProduction && !isBrowser) {
  // Build phase — warn but don't fail. Skip in the browser: the client
  // bundle never has access to server-only secrets and warning about them
  // pollutes the DevTools console on every page.
  const strictParsed = productionSchema.safeParse(process.env);
  if (!strictParsed.success) {
    const errors = strictParsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.warn(
      `\n[env] Missing environment variables (non-fatal in development):\n${errors}\n`
    );
  }
}

/**
 * Validated environment variables.
 * In production at runtime, the app throws if any required variable is missing.
 * During build and in development, missing variables fall back to empty defaults.
 */
export const env = parsed;

assertEnvPresence(parsed);
