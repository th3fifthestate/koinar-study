import { env } from "./env";

/** Edge-safe path join: strips trailing slash from base and joins with segment */
function joinPath(base: string, segment: string): string {
  return base.replace(/\/$/, "") + "/" + segment;
}

export const config = {
  session: {
    secret: env.SESSION_SECRET,
    ttlDays: 7,
    cookieName: "bible_study_session",
  },
  ai: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    fluxApiKey: env.FLUX_API_KEY,
    modelId: env.AI_MODEL_ID,
  },
  bible: {
    esvApiKey: env.ESV_API_KEY,
  },
  r2: {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  },
  db: {
    app: env.DATABASE_PATH,
    bibleDir: env.BIBLE_DB_PATH,
    get bsb() {
      return joinPath(this.bibleDir, "BSB.db");
    },
    get hebrewGreek() {
      return joinPath(this.bibleDir, "bible_hebrew_greek.db");
    },
    get strongs() {
      return joinPath(this.bibleDir, "strongs.sqlite");
    },
    get crossRefs() {
      return joinPath(this.bibleDir, "cross_references.db");
    },
  },
  email: {
    resendApiKey: env.RESEND_API_KEY,
    resendAudienceId: env.RESEND_AUDIENCE_ID,
  },
  encryption: {
    key: env.ENCRYPTION_KEY,
  },
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
  },
} as const;
