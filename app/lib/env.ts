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
// Treat build-time as non-strict even when NODE_ENV=production.
const strictValidation = isProduction && !isBuildPhase;

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
  // ABS termination kill-switch — when true, getAvailableTranslations() hides
  // every licensed translation. Operational flag; see runbooks/abs-termination-purge.md.
  ABS_PURGE_ENABLED: z
    .string()
    .default("")
    .transform((v) => v === "true"),

  // Image generation
  FLUX_API_KEY: z.string().default(""),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET_NAME: z.string().default("koinar-images"),
  R2_PUBLIC_URL: z.string().default("images.koinar.app"),

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
} else if (isProduction) {
  // Build phase — warn but don't fail
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

assertEnvPresence();
