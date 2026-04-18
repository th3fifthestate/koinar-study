# Brief 30 — Study Bench: Phase 5c Direction

> **Scope.** This is the direction document for Phase 5c (Study Bench). Every subsequent brief (31a → 35b) cites sections of this document as source of truth. It locks philosophy, the Clipping primitive, the canvas model, surfaces and routes, source-ingestion strategy, the compliance re-wiring around per-board views, templates, the license meter, the data model, the phased rollout, explicit out-of-scope, and the risk register.
>
> **Phase 5c scaffolding** already exists in [`founders-files/implementation-plan.md`](implementation-plan.md) lines 1249–1379 and references this file at line 1307. The two documents are designed to agree.

---

## Context (why this change, why now)

Koinar today is a reading experience: the reader renders BSB study markdown, wraps verse references and entity terms inline, and exposes a three-tier context primitive (Quick Glance popover → Drawer → Branch Map). Translations swap mechanically via `app/lib/translations/swap-engine.ts`; a DHCP-lease verse cache (`app/lib/translations/cache.ts`) keeps licensed text bounded; the full ABS compliance surface (FUMS tracker, NIV display guard, CopyGuard, citations) is already in place.

What the app *cannot* do is help a user **parse, compare, and synthesize** across those resources. A user cannot lay a verse next to a lexicon entry next to their own note next to two parallel translations and draw a line between them. The "research-and-wrestle" muscle has no home.

**Study Bench** is that home. It is a neutral library-table surface where the user brings a question and the app organizes — but never interprets. Shipping it inside the V1 envelope (Phase 5c, after 5b's translations polish, before Phase 6 export + launch) anchors the context primitive as a *tool*, not just a sidebar. Deferring risks the launch reading as "YouVersion with better footnotes."

---

## 1. Executive summary

**Study Bench** is Koinar's desktop-first library-table surface. A user opens a board, types a question, and drags in typed *Clippings* — verses, entity snippets, translation-compare strips, cross-reference chains, lexicon entries, their own notes, or entire study sections — positioning them freely on an infinite pan-and-zoom canvas and connecting them with free-text-labeled arrows. The app organizes and surfaces; the user interprets. No AI runs inside the Bench at v1 (deterministic-only); Gemma-family lookup assist is parked for V2. Mobile is view-only. Each board is **one Biblica §V.F view**, so the NIV 25-verse / 2-chapter cap applies per-board — users can own many boards, each independently obeying the cap. The primitive is **reference-only**: clippings store `{type, source_ref, position}`, never licensed text bodies, so the global `verse_cache` stays bounded and license terminations purge cleanly.

Philosophy in one sentence: **a neutral library table — the user thinks; the app organizes.**

The Bench exists because Koinar's differentiated pitch — context-aware Bible study — only becomes a *tool* when the user can arrange context against their own question. Shipping it in 5c makes that differentiation visible at launch. It compounds the entity graph (Phase 3), the translation swap (Phase 5a/b), and the user annotations already built. It ships in five waves (foundations → canvas MVP → clipping suite + reader rail → templates + meter + compliance wiring → polish + onboarding) over eleven briefs (30 → 35b).

---

## 2. The Clipping primitive

Everything in the Bench is a Clipping. Getting the primitive right is the whole game.

### 2.1 What a Clipping is

A **Clipping** is a *typed, positioned reference to existing in-app data* — never a copy of the data itself.

```ts
type Clipping = {
  id: string;                          // ulid; authored client-side, confirmed server-side
  board_id: string;                    // FK → bench_boards.id
  type: ClippingType;                  // the 7 v1 types below
  source_ref: ClippingSourceRef;       // type-specific payload (see §2.3)
  x: number;                           // canvas-plane x (float, arbitrary units)
  y: number;                           // canvas-plane y
  width: number;                       // card width in canvas units
  height: number;                      // card height in canvas units
  color?: ClippingColor | null;        // user swatch; null = default
  user_label?: string | null;          // user-authored title (defaults to source's natural label)
  created_at: number;
  updated_at: number;
};
```

### 2.2 Why reference-only, not text-body

Three reasons:

1. **Compliance.** If the Bench stored NIV text per clipping, the global `verse_cache` LRU stops being the authoritative bound on licensed-text storage; termination purges would need to fan out across boards and clippings. By storing `{translation, book, chapter, verse}` only, the cache at `app/lib/translations/cache.ts` remains the one-and-only store; `purgeLicensedCache()` alone satisfies the 72-hour termination contract.
2. **Freshness.** DHCP-lease renewals propagate automatically; a clipping that referenced stale text would drift.
3. **Mobility.** The same verse can appear on hundreds of boards without data duplication; one fix to the source propagates everywhere.

### 2.3 The 7 v1 types

| # | Type | `source_ref` shape | Render spec | Editable | Data source (exists today) |
|---|------|-------------------|-------------|----------|---------------------------|
| 1 | `verse` | `{ translation, book, chapter, verse_start, verse_end }` | Scripture-block card: ref header · verse text (re-fetched from `verse_cache`) · translation chip · citation footer for licensed | `user_label`, `color`, position | `verse_cache` + `swap-engine` verse fetcher |
| 2 | `entity_snippet` | `{ entity_id, tier: 'glance' \| 'summary' }` | Entity card: name · type-badge · `quick_glance` (tier 1) or `summary` (tier 2) · "open drawer" → existing entity drawer | `user_label`, `color`, position, `tier` | `entity-popover.tsx`, `entity-drawer.tsx`, `getEntityDetail()` |
| 3 | `translation_compare` | `{ book, chapter, verse_start, verse_end, translations: [t1, t2, …] }` | Two-to-four-column strip; one column per translation; footer chips cite each | `user_label`, `color`, position, `translations[]` set | `swap-engine.ts` per-verse fetcher, reused in a batched compare call |
| 4 | `cross_ref_chain` | `{ from_verse: {book, ch, v}, refs: [{book, ch, v, weight?}] }` | Card: anchor verse at top · numbered list of referenced verses with inline text (fetched via cache) · "expand all" toggle | `user_label`, `color`, position, filter by weight | New `cross_refs` table (Wave 1, brief 31a; TSK, PD, ~340k rows) |
| 5 | `lexicon_entry` | `{ strongs_id }` (e.g. `"H0001"`, `"G5547"`) | Card: headword · transliteration · gloss · full definition (markdown) · occurrence count | `user_label`, `color`, position | New `lexicon_entries` table (Wave 1, brief 31b; STEPBible CC BY 4.0, ~14k rows) |
| 6 | `user_note` | `{ annotation_id }` OR `{ inline_text }` (user-typed standalone note) | Note card: inline-text or existing-annotation pulled-quote · link back to source study if annotation | full `inline_text` edit, `user_label`, `color`, position | `annotations` table; or inline-only, stored in `bench_clippings.source_ref.inline_text` |
| 7 | `study_section` | `{ study_id, section_slug, excerpt_range?: [start, end] }` | Card: study title · section heading · first ~200 words · "open study" link | `user_label`, `color`, position, `excerpt_range` trim | `studies` table + markdown renderer for preview |

Seven types, chosen to cover: reading (1), context (2), comparison (3), cross-reference (4), original language (5), the user's own voice (6), and synthesis-from-prior-studies (7). No eighth type ships in v1.

### 2.4 v2 parking

Parked explicitly — each with a named reason:

- **Geography / map card.** Needs OpenBible.info geocoding ingestion (v2) and a map renderer. Scope + ingestion cost.
- **ISBE encyclopaedia excerpt.** ~3.7M words PD; ingestion + normalization is a standalone multi-day project. v1.1 target.
- **Tyndale Open Study Note.** Licensing review required; CC BY-NC permissions sit outside current compliance surface. V2 target.
- **Nave's topical cluster.** Category data useful but ingestion not scoped. V2.
- **Sketch / free-draw.** Real editor scope; canvas primitive is cards + arrows at v1. V2.

### 2.5 Why not an LLM-generated summary Clipping

An AI-synthesized "summary" clipping would *lean the user* — it would encode an interpretive voice into what the library table offers. This violates the non-negotiable guardrail ("the app never leans"). **Parked forever** unless the founder explicitly revisits.

---

## 3. Canvas model

### 3.1 Surface

Infinite pan + zoom 2D plane. Clippings positioned by absolute canvas coordinates (floats). Zoom range: 0.25× to 4×. Pan: unbounded. The plane is the library table; the clippings are the resources fanned out across it.

Arrows connect two clippings by their ids, with an optional user-typed label (free text, up to 60 chars). **No preset taxonomy of relationships** — any preset ("supports", "contradicts", "cites") would lean the user's interpretation. Blank is always an option.

### 3.2 Interaction primitives

| Gesture | Action |
|---------|--------|
| Drag clipping | Move (snapped to 8px grid when `Shift` held) |
| Drag corner/edge handle | Resize (min 160×80; max 800×600) |
| Double-click clipping | Expand tier-1 preview → tier-2 full inline; second double-click collapses |
| Right-click | Context menu: duplicate · delete · send-to-back · bring-to-front · change color · convert-to-template-slot |
| `Cmd/Ctrl+D` | Duplicate |
| `Delete`/`Backspace` | Delete selection |
| `]` / `[` | Bring forward / send back |
| Drag from clipping edge-handle to another clipping | Create connection; label prompt appears inline |
| Space + drag | Pan |
| `Cmd/Ctrl + scroll-wheel` | Zoom toward cursor |
| `Cmd/Ctrl + 0` | Fit board to viewport |
| `Cmd/Ctrl + 1` | Zoom to 100% |
| `?` | Open keyboard cheat-sheet modal |

### 3.3 Multi-select

Lasso (drag on empty canvas); `Shift+click` to add/remove; group-move by dragging any selected clipping; bulk delete; bulk color-change. Multi-select disables resize (not worth the UX tangle for v1).

### 3.4 Autosave semantics

Optimistic local writes; 250ms debounce; single `PATCH /api/bench/clippings/:id` per debounced flush. Undo stack lives in memory, 20 deep. **No explicit Save button** — the user never thinks about saving. Offline writes queue in `localStorage` keyed by clipping id; reconcile on reconnect with last-write-wins (v1 does not support multi-device concurrency).

### 3.5 Viewport persistence

Per-board camera state `{ x, y, zoom }` persists on pan-end / zoom-end (debounced) via `PATCH /api/bench/boards/:id/camera`. On next open the board restores to exactly where the user left it. The metaphor — you walked away from the table; when you come back the papers haven't moved.

### 3.6 Out of scope for v1

- Version history / time-travel
- Branching (fork a board into variants)
- Collaborative real-time cursors / multiplayer
- Presence indicators
- Comments on clippings
- Tags, folders, or search-within-board beyond keyboard-driven jump

---

## 4. Surfaces and routing

### 4.1 `/bench` — Dashboard

Grid of the user's boards. Each card: **title** · **question** · **thumbnail** (rendered server-side low-res canvas snapshot, regenerated on board-close) · **clipping count** · **last-edited relative time**. Top-right: `+ New board` (opens template picker; Blank + 3 starter templates). Empty state: quiet editorial copy — "A blank library table. Bring a question." — and a single CTA to create the first board.

Nav entry added to primary nav alongside Home, Library, Favorites, Profile at `app/app/(main)/layout.tsx`.

### 4.2 `/bench/[boardId]` — Canvas

Top bar: **title** (editable inline) · **question** (editable inline) · **license-meter chips** (one per licensed translation; see §8) · **template-applied badge** (if any) · **open-in-help** `?` icon.

Left rail (360px, collapsible): **Source drawer**. Six tabs: `Verses`, `Entities`, `Cross-refs`, `Lexicon`, `Studies`, `Notes`. Search in each tab; results render as draggable cards; dragging onto the canvas instantiates the corresponding Clipping type at drop coordinates.

Right rail (280px, collapsible): **Recent Clips tray**. Most recently created clippings across all of the user's boards (tray-only, 20 most recent). Draggable out to canvas; clicking a recent clip's "jump" icon opens its original board. Also shows clips sent from the reader that haven't been placed yet.

Canvas surface fills the remaining viewport. Pan/zoom + clippings + connections.

### 4.3 Reader integration — three "Clip to Bench" affordances

1. **Text-selection popover** (`app/components/reader/annotation-popover.tsx`). A third action appears after "Context": **Clip to Bench**. Clicking creates a `verse` clipping (if the selection resolves to one or more verse refs) or a `user_note` clipping with `inline_text` = selected text otherwise. Action mirrors the existing `.rounded-md.px-2.5.py-1.text-xs` button pattern.
2. **Entity Quick-Glance popover** (`app/components/reader/entity-popover.tsx`). A small "Clip" button sits next to "Explore →". Clicking creates an `entity_snippet` clipping (`tier: 'glance'`) from the current entity.
3. **Cross-ref tooltip** (`app/components/reader/cross-ref-tooltip.tsx`). A small clip-icon button appears in the tooltip. Clicking creates a `verse` clipping from the hovered reference.

Each action sends the new clipping to **Recent Clips** (not placed directly on a canvas). An opt-in user flag (`auto_place_on_active_board`, default OFF) can route clippings to the most-recently-active board's canvas coordinates near center-of-viewport. Default is tray-only — the user chooses when to lay a clip on the table.

### 4.4 No new surfaces out of scope for v1

No `/bench/shared`, `/bench/explore`, no per-board public URL.

---

## 5. Source ingestion strategy (v1)

### 5.1 Reuse without new ingestion

Four data sources already exist and are used directly:

- **Entity graph** — `app/lib/db/entities/queries.ts` (`getEntityDetail`, `searchEntities`, `getRelationshipsForEntity`, `getCitationsForEntity`). Powers `entity_snippet` clippings.
- **Parallel translations** — `swap-engine.ts` + `cache.ts`. Powers `verse` and `translation_compare` clippings.
- **User annotations + notes** — `annotations` table. Powers `user_note` clippings.
- **User studies** — `studies` table. Powers `study_section` clippings.

### 5.2 New ingestion (v1 must-ship)

| Dataset | License | Est. rows | Table | Brief |
|---------|---------|-----------|-------|-------|
| **Treasury of Scripture Knowledge** | Public domain | ~340,000 | `cross_refs` | 31a |
| **STEPBible Lexicon** (TBESH Hebrew + TBESG Greek) | CC BY 4.0 | ~14,000 | `lexicon_entries` | 31b |

Both are small, high-leverage, citation-clean, and offline-ingested once at deploy time. Import scripts live in `app/scripts/import-tsk.ts` and `app/scripts/import-stepbible-lexicon.ts`. Both must be:

- **Idempotent** — re-running produces zero row delta if inputs unchanged
- **Resumable** — interrupt + resume picks up where it left off via row-id checkpointing
- **Dev + production parity** — same script runs on local sqlite and deployed sqlite

### 5.3 Deferred (v1.1 / V2), each with target phase

| Dataset | License | Reason deferred | Target |
|---------|---------|-----------------|--------|
| **ISBE Encyclopaedia** | Public domain | ~3.7M words; normalization effort out of v1 scope | v1.1 |
| **Tyndale Open Resources (Open Study Notes)** | CC BY-NC-ND (review required) | Licensing-review work + footer-compliance mapping; interpretive voice risk to assess | V2 |
| **OpenBible.info geocoding** | CC BY 4.0 | Paired with geography clipping (§2.4), also parked | V2 |
| **Brenton Septuagint** | Public domain | Original-language interest beyond MT; serving a narrow audience for now | V2 |
| **Josephus / Philo (primary sources)** | Public domain | Historical context layer; low ROI for v1 library-table goals | V2 |
| **Sefaria** | CC BY-NC + mixed | Rabbinic commentary; both license-review and voice-review required | V2 |

### 5.4 Table shapes for v1 ingestions (handoff to 31a/b)

```sql
-- cross_refs (brief 31a)
CREATE TABLE IF NOT EXISTS cross_refs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  from_book      TEXT    NOT NULL,   -- OSIS slug, e.g. "gen"
  from_chapter   INTEGER NOT NULL,
  from_verse     INTEGER NOT NULL,
  to_book        TEXT    NOT NULL,
  to_chapter     INTEGER NOT NULL,
  to_verse_start INTEGER NOT NULL,
  to_verse_end   INTEGER,            -- NULL for single-verse targets
  weight         INTEGER,            -- TSK strength 1–5 where parseable, else NULL
  source         TEXT    NOT NULL    -- 'tsk' at v1 (future: 'openbible')
);
CREATE INDEX idx_cross_refs_from ON cross_refs(from_book, from_chapter, from_verse);

-- lexicon_entries (brief 31b)
CREATE TABLE IF NOT EXISTS lexicon_entries (
  strongs_id      TEXT PRIMARY KEY, -- e.g. "H0001", "G5547"
  language        TEXT NOT NULL,    -- 'hebrew' | 'greek'
  headword        TEXT NOT NULL,
  transliteration TEXT,
  pronunciation   TEXT,
  gloss           TEXT NOT NULL,    -- short
  definition      TEXT NOT NULL,    -- long, markdown
  morphology      TEXT,
  source          TEXT NOT NULL     -- 'stepbible' at v1
);
CREATE INDEX idx_lexicon_entries_headword ON lexicon_entries(headword);
```

Schema changes are **additive-only**: new `CREATE TABLE IF NOT EXISTS` blocks appended to `app/lib/db/schema.ts` `CREATE_TABLES`, `SCHEMA_VERSION` bumped from 9 → 10, no modifications to existing tables.

---

## 6. Compliance architecture

The sharpest design call in this brief. The Bench must extend the ABS/Biblica/Crossway surface already in place without weakening it.

### 6.1 Per-board "view" interpretation of Biblica §V.F

**Decision.** Each `bench_boards` row counts as one Biblica §V.F *view*. The 25-verse / 2-chapter NIV cap applies per-board. A user with three boards can reference up to 75 NIV verses across them, but each board independently obeys the cap.

**Justification for the auditor.**

1. Biblica §V.F defines "one view" as a cohesive display of Scripture content to the user. A board in the Study Bench is precisely that: a single persistent workspace centered on a single question, opened as one display, consumed as one cohesive reading surface. It is neither a "device" nor a "session" — it is a discrete, named, persistent *view* with a title, a question, and a finite URL (`/bench/:boardId`).
2. The same user reading the same Scripture across two separate boards — a "What does the NT teach on forgiveness?" board and a "How is Exodus 34 read in Hebrews?" board — is performing two separate acts of study. Treating them as a single view would violate common sense and the spirit of §V.F (which grants *users*, not *applications*, a generous per-view allowance so they can actually study).
3. Each board emits independent FUMS events with `surface: 'bench'` and `board_id` in the payload (§6.4), producing an auditable per-view trail that matches Biblica's tracking expectations.
4. Reader views (`/library/:slug`) and bench boards do not share a view allowance; they are distinct cohesive displays. The reader continues to count as one view per study read; each board counts as one view per board.

This reasoning will be stated in plain English in `/attributions` and captured as a row in `founders-files/abs-compliance-checklist.md` so any future compliance auditor can follow the logic.

### 6.2 Reference-only clippings

No licensed text lives outside `verse_cache`. Clippings store `{translation, book, chapter, verse_start, verse_end}` — nothing more. Rendering re-queries the cache. When a lease expires, the renewal cron refetches; when `purgeLicensedCache()` runs, all rows vanish; when clippings try to render post-purge they encounter a cache-miss → guarded-fallback (cached-expired notice, no licensed text shown).

### 6.3 Pre-warm on board open

`prewarmBoard(boardId)` at `app/lib/bench/prewarm.ts`:

1. Reads all `verse` and `translation_compare` clippings on the board → collects unique `{translation, book, chapter, verse}` tuples.
2. For each, checks `verse_cache`; builds a miss-list.
3. Batches misses per translation → calls `swap-engine`'s per-verse fetcher concurrently (max 10 parallel per translation API).
4. Returns when all verses either render from cache or hit a graceful-failure placeholder.

**Budget:** <1.5s for boards ≤25 licensed verses. Larger boards show a brief spinner on the canvas edge. Boards >50 licensed verses are allowed but fall off the SLA explicitly.

### 6.4 FUMS extension

`app/lib/translations/fums-tracker.ts` gains a `surface` dimension:

```ts
export interface FumsEventInput {
  // existing fields
  translation: string;
  fumsToken: string | null;
  eventType: "fetch" | "display";
  studyId?: number;
  userId?: number;
  verseCount: number;
  // new field
  surface: 'reader' | 'bench';
  boardId?: string;    // present when surface === 'bench'
}
```

Schema: add `surface TEXT NOT NULL DEFAULT 'reader'` and `board_id TEXT` columns to `fums_events` (additive, backfill `reader` for existing rows). Every bench render of a licensed verse fires one `display` event per verse per mount.

### 6.5 CopyGuard extension

Refactor `app/components/reader/CopyGuard.tsx` into a shared hook `useCopyCap({ surface, translation })` at `app/components/shared/useCopyCap.ts`. Both reader and bench mount the hook at their respective root containers. The 100-verse clipboard cap enforces globally across both surfaces.

### 6.6 NIV display guard per board

`app/lib/translations/niv-display-guard.ts`'s `enforceNivPerViewCap` accepts a new second parameter:

```ts
export type DisplaySurface =
  | { kind: 'reader'; studyId: number }
  | { kind: 'bench'; boardId: string };

export function enforceNivPerViewCap(
  refs: ViewVerseRef[],
  surface: DisplaySurface,
): NivGuardResult;
```

The cap logic is unchanged (2 chapters OR 25 verses — whichever allowance is greater). The `surface` argument tags the event and scopes the cap to the correct view: reader uses `studyId` keyspace, bench uses `boardId` keyspace. Hard-block at cap: render the cap-hit modal citing Biblica §V.F in plain English, not clause text.

### 6.7 Export explicitly out of scope for v1

No "download board as PDF" or "export as image" in v1. This sidesteps the NIV export prohibition cleanly. When export lands in v1.1, NIV clippings will be excluded or tokenized per Crossway/Biblica contracts — design deferred.

### 6.8 Checklist rows changed by the Bench

From `founders-files/abs-compliance-checklist.md` the rows whose implementation the Bench changes:

- Row 11 (clipboard DRM cap) — extended to bench via `useCopyCap`.
- Row 12 (per-translation storage cap) — unchanged backend; bench reuses the same LRU.
- Row 16 (NIV per-view cap) — extended to per-board scoping.
- Row 23 (FUMS per-verse tracking) — adds `surface` + `board_id` dimensions.
- Row 30–32 (termination purge) — unchanged; reference-only design means no bench-specific purge path needed.

Every other row is untouched.

---

## 7. Templates

Three starter templates plus Blank. **Templates scaffold; they do not interpret.** Every template is a pre-positioned arrangement of *empty placeholder clippings* — slots the user fills by searching the source drawer. No AI fills anything.

### 7.1 Word Study

Centered lexicon-entry slot. Six concordance-hit slots arranged radially around the lexicon slot (at 12-, 2-, 4-, 6-, 8-, 10-o'clock positions). One translation-compare strip slot below. The user searches a Hebrew/Greek word → drops into the lexicon slot → cross-refs populate the concordance slots → a key passage drops into the compare strip.

### 7.2 Character Study

Centered entity slot. Eight verse-reference slots arranged radially (at 45° intervals). A "relationships" band along the bottom with three entity-snippet slots labeled for "family", "allies", "adversaries" (the labels are descriptive placeholders; the user accepts or renames them).

### 7.3 Passage Study

Passage slot top-center (one `verse` clipping, multi-verse range). Parallel-translations band below (one `translation_compare` strip, three-column default). TSK cross-ref chain in a left column. User-notes column on the right (four `user_note` slots).

### 7.4 Blank (default)

Zero slots. The empty library table.

Templates are authored in detail by **brief 34a** and implemented by **brief 34b**. Brief 30 locks the *existence, count, and names* of the three — further voice / layout detail is 34a's job.

---

## 8. License meter

A chip strip in the top bar of every board, one chip per licensed translation that has at least one clipping on the current board:

```
[NIV 18 / 25 verses ●]  [NLT 12 / 500 ●]  [NASB 3 / 1000 ●]  [ESV 4 / 500 ●]
```

Open (unmetered) translations (BSB/KJV/WEB) do not appear. Each chip shows the current licensed-verse count for this board against the contract cap for that translation.

### 8.1 States

| State | Threshold | Visual |
|-------|-----------|--------|
| Normal | 0–79% | Neutral slate chip |
| Soft warning | 80–99% | Amber chip; subtle fill bar |
| Hard block | ≥100% | Red chip; attempts to drop a further licensed clipping of that translation trigger the cap-hit modal |

### 8.2 Cap-hit modal

Title: "You've reached NIV's quote limit for this board." Body (plain English summary, not clause text): "Biblica's license lets Koinar show up to 25 NIV verses, or 2 full chapters, per board. You can continue this study on a new board — or switch this clipping to BSB, KJV, or WEB (no limit)." Primary CTA: "Switch translation"; Secondary CTA: "Start a new board"; Tertiary link: "See full attribution" → `/attributions#niv`.

### 8.3 Chip click behavior

Chip click → `/attributions#<translation>`. Deep-linked anchors already exist on `/attributions`; brief 34b confirms the anchors match.

---

## 9. Data model (new tables)

All additive to `app/lib/db/schema.ts`; no existing tables modified. `SCHEMA_VERSION` bumped 9 → 10.

```sql
CREATE TABLE IF NOT EXISTS bench_boards (
  id           TEXT PRIMARY KEY,   -- ulid
  user_id      INTEGER NOT NULL,
  title        TEXT NOT NULL,
  question     TEXT,
  camera_x     REAL NOT NULL DEFAULT 0,
  camera_y     REAL NOT NULL DEFAULT 0,
  camera_zoom  REAL NOT NULL DEFAULT 1,
  template_id  TEXT,                -- 'blank'|'word'|'character'|'passage'|NULL
  thumbnail    TEXT,                -- server-rendered low-res data-url or CDN path
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_bench_boards_user_updated ON bench_boards(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bench_clippings (
  id          TEXT PRIMARY KEY,   -- ulid
  board_id    TEXT NOT NULL,
  type        TEXT NOT NULL,      -- 'verse'|'entity_snippet'|'translation_compare'|
                                  -- 'cross_ref_chain'|'lexicon_entry'|'user_note'|'study_section'
  source_ref  TEXT NOT NULL,      -- JSON payload, type-specific (§2.3)
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  width       REAL NOT NULL,
  height      REAL NOT NULL,
  color       TEXT,
  user_label  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (board_id) REFERENCES bench_boards(id) ON DELETE CASCADE
);
CREATE INDEX idx_bench_clippings_board ON bench_clippings(board_id);

CREATE TABLE IF NOT EXISTS bench_connections (
  id           TEXT PRIMARY KEY,   -- ulid
  board_id     TEXT NOT NULL,
  from_clip_id TEXT NOT NULL,
  to_clip_id   TEXT NOT NULL,
  label        TEXT,                -- free text, up to 60 chars
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (board_id) REFERENCES bench_boards(id) ON DELETE CASCADE,
  FOREIGN KEY (from_clip_id) REFERENCES bench_clippings(id) ON DELETE CASCADE,
  FOREIGN KEY (to_clip_id)   REFERENCES bench_clippings(id) ON DELETE CASCADE
);
CREATE INDEX idx_bench_connections_board ON bench_connections(board_id);

CREATE TABLE IF NOT EXISTS bench_recent_clips (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  type         TEXT NOT NULL,
  source_ref   TEXT NOT NULL,
  origin       TEXT NOT NULL,      -- 'reader'|'bench'|'source-drawer'
  created_at   INTEGER NOT NULL,
  placed_at    INTEGER,             -- NULL until user drops it on a canvas
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_bench_recent_clips_user_created ON bench_recent_clips(user_id, created_at DESC);
```

Plus the two Wave-1 ingestion tables from §5.4: `cross_refs`, `lexicon_entries`.

**Projected row counts at launch:**
- `cross_refs` — ~340,000 (one-time TSK ingest)
- `lexicon_entries` — ~14,000 (one-time STEPBible ingest)
- `bench_boards` — ~3 per active user (early guess)
- `bench_clippings` — ~15 per board median
- `bench_connections` — ~5 per board median
- `bench_recent_clips` — capped at last 20 per user via query LIMIT; prune job monthly

---

## 10. Phased rollout — the Phase 5c wave map

**DAG** (→ = hard dependency; ∥ = parallelizable):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Wave 0 — Direction                                                      │
│     30 (this brief)                                                      │
│     ↓                                                                    │
│  Wave 1 — Foundations (not user-visible)                                 │
│     (31a ∥ 31b) → 31c                                                    │
│     ↓                                                                    │
│  Wave 2 — Canvas MVP (first user-visible surface)                        │
│     32a ∥ (31a, 31b, 31c)  →  32b                                        │
│     ↓                                                                    │
│  Wave 3 — Clipping suite + reader rail                                   │
│     33                                                                   │
│     ↓                                                                    │
│  Wave 4 — Templates + meter + compliance wiring                          │
│     34a ∥ 33  →  34b                                                     │
│     ↓                                                                    │
│  Wave 5 — Onboarding + polish + exit gates                               │
│     35a ∥ 34b  →  35b                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Brief-by-brief owners

| Brief | Wave | Owns |
|-------|------|------|
| **30** (this) | 0 | Philosophy, Clipping primitive, canvas model, compliance architecture, data model, phased rollout, risk register |
| **31a** | 1 | TSK ingestion — `cross_refs` table + `import-tsk.ts` |
| **31b** | 1 | STEPBible ingestion — `lexicon_entries` table + `import-stepbible-lexicon.ts` |
| **31c** | 1 | `bench_*` tables + `useCopyCap` refactor + `niv-display-guard` + `fums-tracker` + `surface`/`board_id` wiring |
| **32a** | 2 | Canvas design spec — visual language, motion table, a11y story, card anatomy, zoom curve, empty-state voice |
| **32b** | 2 | Canvas MVP implementation — pan/zoom, 3 clipping types (verse, entity, note), connections, `/bench` dashboard, API routes |
| **33** | 3 | Remaining 4 clipping types, source-drawer 6-tab search, Recent Clips tray, reader Clip-to-Bench in all three surfaces |
| **34a** | 4 | Template layouts (Word / Character / Passage Study) + license-meter chip design + cap-modal copy |
| **34b** | 4 | Template runtime + meter implementation + wiring extended NIV guard + `trackFumsEvent({surface})` + `useCopyCap` + `prewarmBoard` into live paths |
| **35a** | 5 | Onboarding design — first-run coach-marks, every empty-state copy block, the single celebratory micro-moment (first-connection aura), keyboard cheat-sheet visual |
| **35b** | 5 | Onboarding implementation + a11y sweep + keyboard taxonomy + Lighthouse pass + mobile-readonly banner + cross-browser QA |

### Gating

- **No 31c until both 31a and 31b are green** (foundation ingestions must land before schema changes that reference them).
- **No 32b until both 31c and 32a are approved** (compliance wiring + design spec).
- **No 33 until 32b is green** (33 layers onto MVP canvas).
- **No 34b until 33 is green** (meter wiring needs the full 7 clipping types live).
- **No 35b until 34b is green AND 35a is approved** (35b wires onboarding + QA against a fully-loaded canvas).

---

## 11. Explicit out-of-scope for v1

- **Any AI / LLM inside the Bench.** Gemma-family lookup deferred to V2; no summary clippings ever.
- **Sharing / collaboration.** "Send board to partner" targeted V2; small-group mode V3.
- **Export (PDF/PNG).** Deferred to v1.1; NIV export remains prohibited and needs a dedicated compliance review before ever shipping.
- **Mobile canvas editing.** Mobile (<900px) is view-only with a banner. Reader's Clip-to-Bench still works on mobile — the clip lands in Recent Clips for later desktop placement.
- **Geography / map card.** V2, alongside OpenBible.info ingestion.
- **PD commentary sediment** (Matthew Henry, JFB). Interpretive voice risk; parked.
- **Version history / time-travel.** Not scoped.
- **Board templates authored by users.** v1.1 at earliest.
- **Per-clipping comments / threaded notes.** V2.
- **Tags, folders, board search.** V2.

---

## 12. Risks and open questions

### R1. Canvas performance at 100+ clippings

**Risk.** Pan/zoom jank as clipping count climbs; React reconciliation cost on drag at many selected cards.

**Mitigation.** Brief 32a must benchmark native CSS transforms with `transform: translate3d()` + `will-change: transform` against `react-zoom-pan-pinch` and any other library path (yjs canvas, custom canvas/WebGL). The winner is the one that holds 60fps on a 150-clipping board in Chrome and Safari on mid-range hardware. Decision deferred to 32a.

### R2. Drag-to-connect UX across zoom levels

**Risk.** At 0.25× zoom the connection handles are tiny; at 4× zoom two adjacent clippings' handles overlap.

**Mitigation.** Handles scale inversely with zoom (visual size stable); connection creation has a wider hit-target than visual size (min 24×24px hit zone at any zoom). Prototype early in 32b; brief 32a locks the math.

### R3. Pre-warm latency exceeding budget under high LRU churn

**Risk.** A user opens a 40-verse board after a month offline; 35 of 40 cache rows evicted; 35 synchronous fetches to api-bible + ESV hit rate limits before completing in <1.5s.

**Mitigation.** Accept an explicit spinner for boards >20 licensed verses. Run fetches in parallel (cap 10/translation). Show per-translation progress. If any translation fails, render the other clippings and show a retry chip for the failed ones (graceful degradation). Document the SLA break honestly in the onboarding.

### R4. User confusion between reader annotations and bench clippings

**Risk.** "I highlighted a verse but it's not on my Bench." "I clipped a verse but it's not in my annotations."

**Mitigation.** Reserve three distinct verbs used consistently across product copy: **highlight** (reader annotations only), **note** (reader annotations with text), **clip** (Bench clippings only, never called "highlight to bench"). The reader's "Clip to Bench" action is visually and copy-wise distinct from the color-swatch row.

### R5. Compliance auditor misreads "per board" as over-permissive

**Risk.** A future Biblica audit reviewer sees 75 total NIV verses across three boards and flags a §V.F violation.

**Mitigation.** Four layers: (a) `/attributions` page contains plain-English justification (§6.1). (b) `founders-files/abs-compliance-checklist.md` gains a row citing this brief. (c) FUMS events carry `surface: 'bench'` and `board_id`, producing an audit trail per board. (d) The runbook at `founders-files/runbooks/abs-per-board-view.md` (new, created in 31c) documents the reasoning and links to the contract language.

### R6. Scope creep — every V2 idea is tempting

**Risk.** A rich canvas surface invites wishlist items mid-build (preset relationship labels, smart-connect, AI suggestions, tagging).

**Mitigation.** Enforce the parking list (§2.4 + §11). Every suggestion during 5c gets routed to `founders-files/phase-5c-parked.md`. Brief 30 is the only brief that may update the parking list; others cite it.

### Open questions (resolved before 31c or 32a lands)

- Do ulid or uuid for clipping ids? (Leaning ulid for sortability; 31c decides.)
- Is Recent Clips capped at 20 hard-cap or rolling-30-day? (Leaning hard-cap 20; 32b confirms.)
- Exact amber/red hex values for meter chip? (34a decides; derived from UI-GUIDELINES palette.)
- Thumbnail generation: server-side snapshot vs client-upload on board-close? (32b / 34b decide based on hosting constraints.)

---

## 13. Naming inventory

**Feature name.** **Study Bench** — confirmed by founder. Neutral, library-like, non-churchy.

**Internal namespace.** `bench/`.

**Routes.**
- `/bench` — dashboard.
- `/bench/[boardId]` — canvas.

**Tables.** `bench_boards`, `bench_clippings`, `bench_connections`, `bench_recent_clips`.

**User-facing nouns.** **board**, **clipping**, **connection**, **question**. No jargon. No "canvas" (internal only), no "node/edge" (internal only).

**User-facing verbs.** **clip** (not "highlight to bench", not "send", not "pin"), **connect** (for arrow creation), **drag** (for move/resize). Reader retains **highlight** + **note**; these three verbs never overlap with **clip**.

**File / component names.**
- `app/components/bench/canvas.tsx`
- `app/components/bench/clipping-card.tsx`
- `app/components/bench/connection.tsx`
- `app/components/bench/source-drawer.tsx`
- `app/components/bench/recent-clips-tray.tsx`
- `app/components/bench/board-top-bar.tsx`
- `app/components/bench/board-dashboard.tsx`
- `app/components/bench/clippings/{verse,entity,translation-compare,cross-ref-chain,lexicon,note,study-section}-clipping.tsx`
- `app/components/bench/templates/{blank,word-study,character-study,passage-study}.ts`
- `app/components/bench/license-meter.tsx`, `license-cap-modal.tsx`

**API routes.**
- `GET /api/bench/boards` · `POST /api/bench/boards` · `PATCH /api/bench/boards/:id` · `DELETE /api/bench/boards/:id`
- `GET /api/bench/boards/:id/clippings` · `POST /api/bench/clippings` · `PATCH /api/bench/clippings/:id` · `DELETE /api/bench/clippings/:id`
- `POST /api/bench/connections` · `PATCH /api/bench/connections/:id` · `DELETE /api/bench/connections/:id`
- `GET /api/bench/recent-clips`
- `POST /api/bench/user-flags` (auto-place toggle etc.)
- All routes call `requireAuth()` first; another user's board returns 404 (not 403) to avoid id enumeration.

---

## Acceptance criteria

- All 13 sections written.
- Every design decision has a named owner brief (31a → 35b).
- Compliance section cross-checked row-by-row against `founders-files/abs-compliance-checklist.md`; rows 11, 12, 16, 23, 30–32 named explicitly.
- Phased rollout has a text DAG diagram showing parallelizable pairs.
- Referenced from `implementation-plan.md` Phase 5c section (line 1307).
