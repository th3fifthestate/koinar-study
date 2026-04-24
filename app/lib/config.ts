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
    apiBibleKey: env.API_BIBLE_KEY,
    /** Starter plan Bible IDs — populate after first deploy via GET /v1/bibles. */
    translationIds: {
      NLT: env.API_BIBLE_ID_NLT,
      NIV: env.API_BIBLE_ID_NIV,
      NASB: env.API_BIBLE_ID_NASB,
    },
    cache: {
      /** DHCP lease in seconds — 7 days. ToS requires cache recency ≤ 30 days. */
      leaseSeconds: 7 * 24 * 60 * 60,
      /** Renewal threshold — refetch when ≥ 75% of lease has elapsed. */
      renewalRatio: 0.75,
      /** LRU cap per translation — enforced on insert. */
      perTranslationVerseCap: 25_000,
    },
    copy: {
      /** DRM cap per copy action. Applies to licensed translations only. */
      maxVersesPerCopy: 100,
    },
    niv: {
      /** Biblica §V.F: 2 chapters OR 25 verses per user per view, whichever greater. */
      maxChaptersPerView: 2,
      maxVersesPerView: 25,
    },
    retention: {
      /** FUMS event retention — 13-month buffer on a 12-month floor. */
      fumsEventMonths: 13,
    },
    /** 72-hour termination kill-switch. Hides licensed translations app-wide. */
    purgeEnabled: env.ABS_PURGE_ENABLED,
    /** sha256 salt for FUMS uId. See FUMS_UID_SALT in env.ts. */
    fumsUidSalt: env.FUMS_UID_SALT,
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
