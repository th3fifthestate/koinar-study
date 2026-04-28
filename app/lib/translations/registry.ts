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
  /**
   * Whether downloadable exports (PDF/DOCX) are permitted for this
   * translation. Public-domain translations and most licensed translations
   * allow export with the long-form copyright embedded; NIV is the
   * exception — Biblica §V (NIV License) prohibits "uncontrolled
   * downloads", so NIV is display-only in the reader and the export
   * surface must keep it disabled.
   */
  exportAllowed: boolean;
  /**
   * User-facing reason shown in the export dialog when `exportAllowed`
   * is false. Only set for the disabled cases.
   */
  exportDisabledReason?: string;
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
    exportAllowed: true,
  },
  KJV: {
    id: "KJV",
    name: "KJV",
    fullName: "King James Version",
    source: "local",
    isLicensed: false,
    isInstant: true,
    publisherUrl: "",
    exportAllowed: true,
  },
  WEB: {
    id: "WEB",
    name: "WEB",
    fullName: "World English Bible",
    source: "local",
    isLicensed: false,
    isInstant: true,
    publisherUrl: "",
    exportAllowed: true,
  },
  NLT: {
    id: "NLT",
    name: "NLT",
    fullName: "New Living Translation",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.tyndale.com",
    exportAllowed: true,
  },
  NIV: {
    id: "NIV",
    name: "NIV",
    fullName: "New International Version",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.biblica.com",
    exportAllowed: false,
    exportDisabledReason:
      "NIV is available for in-app reading only per Biblica's licensing terms.",
  },
  NASB: {
    id: "NASB",
    name: "NASB",
    fullName: "New American Standard Bible (1995)",
    source: "api-bible",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.lockman.org",
    exportAllowed: true,
  },
  ESV: {
    id: "ESV",
    name: "ESV",
    fullName: "English Standard Version",
    source: "esv-api",
    isLicensed: true,
    isInstant: false,
    publisherUrl: "https://www.esv.org",
    exportAllowed: true,
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

/**
 * Whether `id` may be exported as a downloadable file (PDF/DOCX) right now.
 *
 * Two conjoined conditions:
 *   1. The translation's static `exportAllowed` permission (NIV is always
 *      false per Biblica §V; everything else is currently true).
 *   2. The translation is in the live `getAvailableTranslations()` set —
 *      this is what makes the export pipeline fail closed under the
 *      72-hour purge kill-switch and under any per-translation gating
 *      (e.g. a missing `API_BIBLE_ID_*` after Variant B termination).
 *
 * Both the export API route and the export dialog UI call this — single
 * source of truth so the button state and the server-side check can never
 * disagree.
 */
export function isExportAllowed(id: TranslationId): boolean {
  const info = TRANSLATIONS[id];
  if (!info.exportAllowed) return false;
  return getAvailableTranslations().some((t) => t.id === id);
}
