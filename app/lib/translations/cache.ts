// app/lib/translations/cache.ts
//
// DHCP-lease rolling cache for licensed translations.
//
//   - `getCachedVerse` returns null when a row is missing or past its lease
//     expiry (treated as a miss so the caller refetches).
//   - `setCachedVerse` writes with a fresh lease = now + config lease.
//   - `enforceStorageCap` performs LRU eviction by `last_access ASC`.
//   - `purgeLicensedCache` is called by the 72-hour termination runbook.

import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";

export interface CachedVerse {
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  fetchedAt: number;
  leaseExpires: number;
  lastAccess: number;
  fumsToken: string | null;
}

export interface SetCachedVerseInput {
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  fumsToken: string | null;
}

export function getCachedVerse(
  translation: string,
  book: string,
  chapter: number,
  verse: number,
): CachedVerse | null {
  const db = getDb();
  const now = nowSeconds();
  const row = db
    .prepare(
      `SELECT translation, book, chapter, verse, text,
              fetched_at AS fetchedAt,
              lease_expires AS leaseExpires,
              last_access AS lastAccess,
              fums_token AS fumsToken
         FROM verse_cache
        WHERE translation = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .get(translation, book, chapter, verse) as CachedVerse | undefined;

  if (!row) return null;
  if (row.leaseExpires < now) return null;

  db.prepare(
    `UPDATE verse_cache SET last_access = ?
      WHERE translation = ? AND book = ? AND chapter = ? AND verse = ?`,
  ).run(now, translation, book, chapter, verse);
  row.lastAccess = now;
  return row;
}

export function setCachedVerse(v: SetCachedVerseInput): void {
  const db = getDb();
  const now = nowSeconds();
  const lease = now + config.bible.cache.leaseSeconds;
  db.prepare(
    `INSERT INTO verse_cache
       (translation, book, chapter, verse, text, fetched_at, lease_expires, last_access, fums_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(translation, book, chapter, verse) DO UPDATE SET
       text = excluded.text,
       fetched_at = excluded.fetched_at,
       lease_expires = excluded.lease_expires,
       last_access = excluded.last_access,
       fums_token = excluded.fums_token`,
  ).run(
    v.translation,
    v.book,
    v.chapter,
    v.verse,
    v.text,
    now,
    lease,
    now,
    v.fumsToken,
  );
}

/** LRU eviction by last_access ASC when a translation exceeds its storage cap. */
export function enforceStorageCap(translation: string): { deleted: number } {
  const db = getDb();
  const cap = config.bible.cache.perTranslationVerseCap;
  const { n: count } = db
    .prepare(`SELECT COUNT(*) AS n FROM verse_cache WHERE translation = ?`)
    .get(translation) as { n: number };
  if (count <= cap) return { deleted: 0 };
  const excess = count - cap;
  const result = db
    .prepare(
      `DELETE FROM verse_cache WHERE rowid IN (
         SELECT rowid FROM verse_cache WHERE translation = ?
         ORDER BY last_access ASC LIMIT ?
       )`,
    )
    .run(translation, excess);
  return { deleted: result.changes as number };
}

/** Rows whose lease has crossed the renewal threshold (≥ 75% elapsed). */
export function findRowsDueForRenewal(translation?: string): CachedVerse[] {
  const db = getDb();
  const minFetchedAt =
    nowSeconds() - config.bible.cache.leaseSeconds * config.bible.cache.renewalRatio;

  const baseSql = `SELECT translation, book, chapter, verse, text,
                          fetched_at AS fetchedAt,
                          lease_expires AS leaseExpires,
                          last_access AS lastAccess,
                          fums_token AS fumsToken
                     FROM verse_cache
                    WHERE fetched_at <= ?`;

  if (translation) {
    return db
      .prepare(`${baseSql} AND translation = ?`)
      .all(minFetchedAt, translation) as CachedVerse[];
  }
  return db.prepare(baseSql).all(minFetchedAt) as CachedVerse[];
}

/** Deletes every row for the listed translations. 72-hour termination runbook. */
export function purgeLicensedCache(translations: string[]): { deleted: number } {
  if (translations.length === 0) return { deleted: 0 };
  const db = getDb();
  const placeholders = translations.map(() => "?").join(",");
  const result = db
    .prepare(`DELETE FROM verse_cache WHERE translation IN (${placeholders})`)
    .run(...translations);
  return { deleted: result.changes as number };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
