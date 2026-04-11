import path from "path";
import { env } from "./env";

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
      return path.join(this.bibleDir, "BSB.db");
    },
    get hebrewGreek() {
      return path.join(this.bibleDir, "bible_hebrew_greek.db");
    },
    get strongs() {
      return path.join(this.bibleDir, "strongs.sqlite");
    },
    get crossRefs() {
      return path.join(this.bibleDir, "cross_references.db");
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
