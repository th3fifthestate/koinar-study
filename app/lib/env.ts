import { z } from "zod";

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------
// This module validates all environment variables at import time.
// In production, missing required variables cause a hard failure.
// In development, missing non-critical variables produce warnings.
//
// Usage: import { env } from "@/lib/env";
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === "production";

// --- Schema ---

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: isProduction
    ? z.string().startsWith("https://", "Must use HTTPS in production")
    : z.string().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_PATH: z.string().default("./data/app.db"),

  // Auth
  SESSION_SECRET: isProduction
    ? z.string().min(64, "SESSION_SECRET must be at least 64 characters (32 bytes hex) in production")
    : z.string().default(""),

  // AI
  ANTHROPIC_API_KEY: isProduction
    ? z.string().min(1, "ANTHROPIC_API_KEY is required in production")
    : z.string().default(""),
  AI_MODEL_ID: z.string().default("claude-opus-4-6"),

  // Email
  RESEND_API_KEY: isProduction
    ? z.string().min(1, "RESEND_API_KEY is required in production")
    : z.string().default(""),
  RESEND_AUDIENCE_ID: isProduction
    ? z.string().min(1, "RESEND_AUDIENCE_ID is required in production")
    : z.string().default(""),

  // Image generation
  FLUX_API_KEY: isProduction
    ? z.string().min(1, "FLUX_API_KEY is required in production")
    : z.string().default(""),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET_NAME: z.string().default("koinar-images"),
  R2_PUBLIC_URL: z.string().default("images.koinar.app"),

  // Encryption
  ENCRYPTION_KEY: isProduction
    ? z.string().min(64, "ENCRYPTION_KEY must be at least 64 characters in production")
    : z.string().default(""),
});

// --- Parse & Validate ---

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  if (isProduction) {
    console.error(
      `\n[env] Missing or invalid environment variables in production:\n${errors}\n`
    );
    process.exit(1);
  } else {
    console.warn(
      `\n[env] Missing environment variables (non-fatal in development):\n${errors}\n`
    );
  }
}

/**
 * Validated environment variables.
 * In production, the app crashes at startup if any required variable is missing.
 * In development, missing variables fall back to empty defaults.
 */
export const env = (parsed.success ? parsed.data : envSchema.parse({
  ...process.env,
})) as z.infer<typeof envSchema>;
