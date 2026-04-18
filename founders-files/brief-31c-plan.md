# Brief 31c — Schema Compliance + Surface Layer: Deliverable Plan

**Drafted:** 2026-04-18
**Branch:** `phase-5c/31c-schema-compliance-surface`
**Status:** Retrospective — implementation complete. This document records what was built.
**Tests:** 199 tests pass across 24 files (`npx vitest run` from `app/`). `npx tsc --noEmit` — 0 errors.

---

## §1 Schema Additions (v11 → v12)

### 1a. New Tables

Four tables added to `app/lib/db/schema.ts` (`CREATE_TABLES` constant):

```sql
CREATE TABLE IF NOT EXISTS bench_boards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  camera_x REAL NOT NULL DEFAULT 0,
  camera_y REAL NOT NULL DEFAULT 0,
  camera_zoom REAL NOT NULL DEFAULT 1,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bench_boards_user ON bench_boards(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bench_clippings (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES bench_boards(id) ON DELETE CASCADE,
  clipping_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  color TEXT,
  user_label TEXT,
  z_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bench_clippings_board ON bench_clippings(board_id);

CREATE TABLE IF NOT EXISTS bench_connections (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES bench_boards(id) ON DELETE CASCADE,
  from_clipping_id TEXT NOT NULL REFERENCES bench_clippings(id) ON DELETE CASCADE,
  to_clipping_id TEXT NOT NULL REFERENCES bench_clippings(id) ON DELETE CASCADE,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bench_connections_board ON bench_connections(board_id);

CREATE TABLE IF NOT EXISTS bench_recent_clips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  clipped_from_route TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bench_recent_user ON bench_recent_clips(user_id, created_at DESC);
```

### 1b. `fums_events` Column Addition

`fums_events` gained a `surface` column to record which UI surface triggered each FUMS event:

```sql
ALTER TABLE fums_events ADD COLUMN surface TEXT NOT NULL DEFAULT 'reader'
```

### 1c. Migration Pattern

The v11 to v12 block lives in `app/lib/db/connection.ts` inside `runMigration()`:

- Four `bench_*` tables, each created via a separate `database.prepare(...).run()` call.
- Indexes created in separate `database.prepare('CREATE INDEX ...').run()` calls immediately after each table.
- The `ALTER TABLE` is wrapped in `try/catch` — SQLite does not allow `ALTER TABLE` inside a multi-statement exec, and fresh DBs already have the column from `CREATE_TABLES`.
- `SCHEMA_VERSION` bumped from 11 to 12 in `app/lib/db/schema.ts`.

The `CREATE TABLE IF NOT EXISTS` pattern in `CREATE_TABLES` makes every table idempotent on fresh DBs. The migration block handles existing DBs that need the new tables added at runtime.

### 1d. TTL Prune for `bench_recent_clips`

Script: `app/scripts/prune-bench-recent-clips.ts`

- Deletes rows where `created_at < datetime('now', '-30 days')`.
- Exits 0 on success, 1 on fatal error (Railway surfaces non-zero as a failed run).
- Railway cron schedule: `0 3 * * *` (daily at 03:00 UTC).
- Follows the same standalone-script pattern as `scripts/renew-cache.ts`.

### 1e. TypeScript Types

All types added to `app/lib/db/types.ts` under a "Study Bench Layer (Brief 31c)" section:

`BenchBoard` — maps directly to the `bench_boards` row. `is_archived` typed as `0 | 1` (SQLite boolean convention).

`BenchClippingSourceRef` — discriminated union keyed on `type`:
- `'verse'` — book/chapter/verse + translation
- `'entity'` — entity_id
- `'translation-compare'` — book/chapter/verse + translations array
- `'cross-ref-chain'` — from_book/from_chapter/from_verse
- `'lexicon'` — strongs_id
- `'note'` — annotation_id
- `'study-section'` — study_id + section_heading

`BenchClipping` — `source_ref` stored as `string` (JSON); callers must `JSON.parse` to `BenchClippingSourceRef`. The `clipping_type` column mirrors the `type` discriminant for fast indexed queries without JSON parsing.

`BenchConnection` — thin join table; `label` is nullable.

`BenchRecentClip` — `payload` is `string` (JSON); same shape as `BenchClipping` would be.

---

## §2 `niv-display-guard.ts` Extension

**File:** `app/lib/translations/niv-display-guard.ts`

### Signature

```ts
export function enforceNivPerViewCap(
  refs: ViewVerseRef[],
  surface: DisplaySurface,
): NivGuardResult
```

`surface` is required — callers cannot omit it. All existing reader callers (in `swap-engine.ts`) were updated to pass `{ kind: 'reader', studyId: String(ctx.studyId) }`.

### Cap Logic

Unchanged from prior implementation. Biblica §V.F caps NIV at 2 chapters OR 25 verses per view — whichever allowance is **greater** (the "greater allowance wins" rule). Truncation only occurs when the request exceeds **both** caps simultaneously. The binding cap (last to be exceeded during the per-verse walk) is reported in `reason`.

```ts
export interface NivGuardResult {
  allowedVerses: ViewVerseRef[];
  truncated: boolean;
  reason?: 'chapter-cap' | 'verse-cap';
}
```

Cap values read from `config.bible.niv.maxChaptersPerView` (2) and `config.bible.niv.maxVersesPerView` (25).

### Telemetry

On truncation only (not on every call):

```ts
console.warn('[niv-guard] cap hit', {
  surface,                      // full DisplaySurface object
  cap_hit_at: allowed.length,   // count of verses allowed before truncation
  translation: 'niv',
});
```

`cap_hit_at` is the length of `allowedVerses` — i.e., the last permitted count before the walk stopped.

### Surface Independence

The guard does not aggregate across surfaces. Each call is evaluated against the caps independently. Cross-surface dedup is a future concern, not in scope for 31c.

---

## §3 `fums-tracker.ts` Extension

**File:** `app/lib/translations/fums-tracker.ts`

### `FumsEventInput` Interface

`surface: DisplaySurface` added as a **required** field:

```ts
export interface FumsEventInput {
  translation: string;
  fumsToken: string | null;
  eventType: 'fetch' | 'display';
  studyId?: number;
  userId?: number;
  verseCount: number;
  surface: DisplaySurface;
}
```

### Serialization

`serializeSurface(surface: DisplaySurface): string` — internal helper, not exported:

| Input | Output |
|-------|--------|
| `{ kind: 'reader', studyId: '42' }` | `'reader'` |
| `{ kind: 'bench', boardId: 'b-abc' }` | `'bench:b-abc'` |

Reader surfaces serialize to the plain string `'reader'` (studyId is already stored in `fums_events.study_id` — no need to duplicate it in the surface column). Bench surfaces serialize as `'bench:{boardId}'` for future per-board FUMS reporting.

### INSERT

```sql
INSERT INTO fums_events
  (translation, fums_token, event_type, study_id, user_id, verse_count, created_at, surface)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

### Callers Updated

- `app/lib/translations/actions.ts`
- `app/lib/translations/swap-engine.ts`
- `app/scripts/renew-cache.ts`

All three now pass a `surface` argument.

### Retention and Flush

Unchanged. `pruneOldFumsEvents()` deletes rows older than `config.bible.retention.fumsEventMonths` (13 months). `flushFumsEvents()` stub is unchanged — real POST to FUMS endpoint deferred pending endpoint confirmation (Brief 13 followup).

### Bench Dedup Contract

The tracker is a dumb append-only log — one row per `recordFumsEvent` call. Bench canvas renders will fire per clipping mount. Dedup responsibility belongs to the Bench surface layer, not the tracker.

---

## §4 `CopyGuard.tsx` Refactor

### Extraction

Copy-cap logic extracted to `app/components/shared/useCopyCap.ts`.

**Hook signature:**

```ts
interface UseCopyCapOptions {
  surface: DisplaySurface;
  currentTranslation: string;
}

export function useCopyCap(
  { surface, currentTranslation }: UseCopyCapOptions
): { containerRef: RefObject<HTMLDivElement> }
```

The hook attaches a `copy` event listener to `containerRef`. On copy:
1. Checks whether the current translation is licensed (`TRANSLATIONS[id].isLicensed`).
2. Counts verse references in the selected text via regex `(/\b\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+\d+:\d+/g)`.
3. If refs exceed `config.bible.copy.maxVersesPerCopy` (100), intercepts the clipboard event, truncates to the first 100 non-empty lines, appends the citation short string, and fires `toast.warning`.
4. If no refs are found (prose selection, no inline verse refs), the cap is not enforced.

The `surface` parameter is accepted for future Bench-specific behavior but is not currently used in the cap decision — the 100-verse cap is uniform across surfaces.

### `CopyGuard.tsx` Thin Wrapper

**File:** `app/components/reader/CopyGuard.tsx`

`surface` is optional on the wrapper component (backward compat for call sites that do not have a studyId at hand), defaulting to `{ kind: 'reader', studyId: 'unknown' }`. It is required on `useCopyCap` itself.

### Reader Wiring

`app/components/reader/study-reader.tsx` passes the real surface:

```tsx
<CopyGuard
  currentTranslation={currentTranslation}
  surface={{ kind: 'reader', studyId: String(study.id) }}
>
```

### Bench Usage

Bench canvas (`app/components/bench/canvas.tsx`) will call `useCopyCap` directly rather than wrapping in `CopyGuard`. Canvas does not exist in this brief — wired in 32a/32b.

### Cap Unchanged

100-verse max (`config.bible.copy.maxVersesPerCopy`). Toast message on truncation unchanged.

---

## §5 Pre-Warm Helper

**File:** `app/lib/bench/prewarm.ts`

### Signature

```ts
export async function prewarmBoard(boardId: string): Promise<void>
```

### Behavior

1. Queries `bench_clippings` for all clippings belonging to `boardId` (columns: `id`, `clipping_type`, `source_ref`).
2. For each clipping where `clipping_type === 'verse'`:
   - `JSON.parse`s `source_ref` to `BenchClippingSourceRef`.
   - If `ref.type === 'verse'`, calls `getCachedVerse(ref.translation, ref.book, ref.chapter, ref.verse)` — writes to verse cache on miss, returns cached row on hit.
3. Per-clipping errors (JSON parse failure, cache error) are caught, logged as `console.warn('[prewarm] skipping clipping', clip.id, err)`, and skipped.
4. Board-level errors (DB query failure) are caught and logged as `console.warn('[prewarm] board pre-warm failed', boardId, err)` — function returns without throwing.

### Non-Fatal Contract

Every error path is caught. A failed pre-warm never prevents the canvas from rendering — the client retries on a cache miss when clippings are mounted.

### Performance Target

Less than 1.5 seconds for up to 25 licensed verse clippings (matching the NIV per-view cap).

### Caller

`/bench/[boardId]` page server component — `await prewarmBoard(boardId)` before render. That route does not exist in this brief; wired in 32a/32b. The helper is available from this brief forward.

---

## §6 Verification Checklist

- [x] All `enforceNivPerViewCap` callers updated to pass a `DisplaySurface`
- [x] All `recordFumsEvent` callers updated to pass a `surface`
- [x] `fums_events` migration runs on fresh + existing DB without errors (`schema-v12.test.ts`: 6/6 pass)
- [x] Unit test: guard blocks 26th NIV verse on reader surface
- [x] Unit test: guard blocks 26th NIV verse on bench surface
- [x] Unit test: guard does NOT aggregate across surfaces (each call evaluated independently)
- [x] Unit test: `useCopyCap` caps clipboard at 100 verses (`config.bible.copy.maxVersesPerCopy`)
- [x] No regression in existing reader NIV cap tests
- [x] `npx vitest run` (from `app/`) — 199 tests, 0 failures
- [x] `npx tsc --noEmit` — 0 new errors

---

## Shared Type: `DisplaySurface`

**File:** `app/lib/bench/types.ts`

```ts
export type DisplaySurface =
  | { kind: 'reader'; studyId: string }
  | { kind: 'bench'; boardId: string }
```

Imported by `niv-display-guard.ts`, `fums-tracker.ts`, `useCopyCap.ts`, and `CopyGuard.tsx`. Single source of truth for the surface discriminated union across the compliance and bench layers.
