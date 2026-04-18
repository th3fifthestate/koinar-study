// app/lib/translations/registry.ts
import { config } from "@/lib/config";

export type TranslationId = "BSB" | "KJV" | "WEB" | "NLT" | "NIV" | "NASB" | "ESV";
export type TranslationSource = "local" | "api-bible" | "esv-api";

export interface TranslationAvailability {
  id: TranslationId;
  name: string;
  /** 'cached' = instant swap. 'uncached' = first swap will verify inline. */
  state: 'cached' | 'uncached';
}

export interface TranslationInfo {
  id: TranslationId;
  name: string;
  fullName: string;
  source: TranslationSource;
  /** Licensed content requires FUMS + DRM + citation on every display. */
  isLicensed: boolean;
  /** Local DB translations resolve synchronously; network ones don't. */
  isInstant: boolean;
  publisherUrl: string;
}

export const TRANSLATIONS: Record<TranslationId, TranslationInfo> = {
  BSB: {
    id: "BSB",
    name: "BSB",
    fullName: "Berean Standard Bible",
    source: "local",
    isLicensed: false,
    isInstant: true,
    publisherUrl: "https://berean.bible",
  },
  KJV: {
    id: "KJV",
    name: "KJV",
    fullName: "King James Version",
    source: "local",
    isLicensed: false,
    isInstant: true,
    publisherUrl: "",
  },
  WEB: {
    id: "WEB",
    name: "WEB",
    fullName: "World English Bible",
    source: "local",
    isLicensed: false,
    isInstant: true,
    publisherUrl: "",
  },
  NLT: {
    id: "NLT",
    name: "NLT",
    fullName: "New Living Translation",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.tyndale.com",
  },
  NIV: {
    id: "NIV",
    name: "NIV",
    fullName: "New International Version",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.biblica.com",
  },
  NASB: {
    id: "NASB",
    name: "NASB",
    fullName: "New American Standard Bible (1995)",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.lockman.org",
  },
  ESV: {
    id: "ESV",
    name: "ESV",
    fullName: "English Standard Version",
    source: "esv-api",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.esv.org",
  },
};

/**
 * Returns the translations selectable by users right now.
 *
 *   - When `config.bible.purgeEnabled` is true, every licensed translation is
 *     hidden (72-hour termination kill-switch; see runbooks/abs-termination-purge.md).
 *   - ESV is hidden unless `ESV_API_KEY` is set (Crossway application is optional).
 *   - api.bible translations (NLT/NIV/NASB) are hidden unless `API_BIBLE_KEY`
 *     AND the corresponding Bible ID are both set.
 *   - TODO(brief-future): enable KJV and WEB once their local SQLite DBs land.
 *     Until then they are registered for UI continuity but filtered out here.
 */
export function getAvailableTranslations(): TranslationInfo[] {
  const apiBibleKey = config.bible.apiBibleKey;
  const esvKey = config.bible.esvApiKey;
  const ids = config.bible.translationIds;
  const purge = config.bible.purgeEnabled;

  return Object.values(TRANSLATIONS).filter((t) => {
    if (t.id === "BSB") return true;
    // TODO(brief-future): enable when KJV/WEB local DBs land.
    if (t.id === "KJV" || t.id === "WEB") return false;
    if (purge) return false;
    if (t.id === "ESV") return Boolean(esvKey);
    if (t.source === "api-bible") {
      return Boolean(apiBibleKey) && Boolean(ids[t.id as "NLT" | "NIV" | "NASB"]);
    }
    return false;
  });
}
