# Brief 35a Plan — Study Bench Onboarding + Empty States

**Branch:** `phase-5c/35a-onboarding-design` off `develop`
**Phase:** 5c — Wave 5 opener. Depends on 34a. Gates 35b. Parallelizable with 34b.
**Model/mode:** Opus + Plan Mode (voice-critical).
**Source of truth for copy:** this document.

---

## §0 — Precedence

This document supersedes **Brief 32a §8** empty-state copy where the two conflict. Brief 32a's motion tokens, color tokens, and breakpoint rules still stand; only the literal copy strings for the fresh-board card, Recent Clips tray empty, and mobile banner are re-voiced here. Future edits to those strings should land in this file, not in 32a.

Governing principle, repeated because it is easy to forget once the scaffolding goes in: **restraint**. The surface teaches by being used. If a sentence explains what a visible feature is, it should not exist. If a flourish would annoy a reader on the tenth board, it should not exist on the first.

---

## §1 — First-run walkthrough on `/bench`

**Trigger:** first visit to `/bench` when `preferences_flags.bench_intro_seen !== true`.

### Step 1 of 3 — Introduction (centered card, no pointer)

> **Welcome to your bench.**
>
> This is a quiet surface for your own study. Pull in verses, entities, notes — arrange them however helps you think. The app never steers. You do.

- Primary: **Show me around** → advances to Step 2.
- Secondary: **Skip intro** → dismisses; sets `bench_intro_seen = true`.
- Motion: card fades up 240ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. A faint paper-grain bleed underneath (reuses the reader's grain filter at 0.4 opacity) to carry continuity from the reader.
- Surround: dim-layer at 40% stone-900 over the rest of the screen.

### Step 2 of 3 — First board (pointer at "New board")

> **Start a board for whatever you're studying.**
>
> You can have as many as you like. Each holds one question and the things that help you answer it.

- Primary: **Got it** → advances to Step 3.
- Pointer: a soft sage-500 outline pulses around the "New board" button for ~2s after this step opens (one pulse cycle, then holds static until dismissed).
- Popover anchored beneath the button, 260px wide, ivory-paper fill, stone-200 hairline.

### Step 3 of 3 — Template picker (pointer at the templates grid)

> **Start blank, or from a shape.**
>
> The three shapes are just scaffolding — placeholder cards you replace as you go. Blank gives you nothing and gets out of the way.

- Primary: **Let's start** → dismisses; sets `bench_intro_seen = true`; opens the template picker.
- Popover anchored above the 2×2 template grid, same styling as Step 2.

### Behavior

- Steps 2 and 3 use `components/ui/popover.tsx` (base-ui wrapper; API is Popover/PopoverContent as elsewhere in the codebase — note: the brief says "shadcn Popover" but the codebase uses base-ui; behavior is equivalent).
- Step 1 uses `components/ui/dialog.tsx`, modal-less (no role=alertdialog), centered via flex.
- Dim-layer: a single fixed `<div>` at z-40, stone-900 / 40%, underneath the card/popover. Fades in with the first step, persists across steps, fades out on dismiss.
- **Escape** at any step → dismiss + set flag.
- **Back button** (native browser Back is too aggressive; use a subtle `←` in the popover header for steps 2 and 3) → retrace one step.
- Each step transition: fade 200ms `cubic-bezier(0.2, 0.8, 0.2, 1)` — the canvas's enter motion.
- `prefers-reduced-motion`: opacity-only; no translate.

### §1.A Storyboard (three frames)

```
  STEP 1                                  STEP 2                                  STEP 3
  ┌──────────────────────────────┐        ┌─────────────┐  [New board]◀─pulse     ┌── 2×2 grid ──┐
  │                              │        │ Start a     │                         │  ▢    ▢      │
  │  Welcome to your bench.      │        │ board…      │                         │  ▢    ▢      │
  │                              │        │ [Got it]    │                         └──────────────┘
  │  This is a quiet surface…    │        └─────────────┘                              ▲ popover
  │                              │         (popover under New board)                   │
  │  [Show me around]  Skip      │                                                ┌────┴──────────┐
  │                              │                                                │ Start blank…  │
  └──────────────────────────────┘                                                │ [Let's start] │
         centered on dim-layer                                                    └───────────────┘
```

---

## §2 — `/bench` dashboard empty state (post first-run, no boards)

Centered on the dashboard route, rendered by an `EmptyBench` component in `components/bench/empty-states.tsx`:

- Illustration: minimalist SVG — **not** a book stack, **not** a lightbulb. A single faint table-surface line with a small sage dot above it (a pen nib, abstract). 120×120, stroke stone-300, dot sage-500 @ 0.7.
- Title: **Nothing on the bench yet.** (26px, reader-display serif, stone-900 @ 0.9)
- Body: **A board is a question and the things around it. Start when you're ready.** (14px, reader-body, stone-700)
- Primary action: **New board** — opens template picker directly.

The illustration's single curve should read as a table-edge, not a horizon. 1px stroke. No shadow. No gradient.

---

## §3 — Fresh board empty state (0 clippings)

Canvas is visible and fully interactive. A centered "orienting card" floats at viewport center the first time a given board is opened empty:

- Title: **An empty board.**
- Body: **Drag something from the left rail to begin. Or clip from a study you're reading and it lands on the right.**
- Dismiss (×) in the upper-right corner of the card.
- **Auto-dismiss** the moment the first clipping is placed on this board (fades 160ms `ease-out`, matches 32a §9 stroke-in).
- **Not a modal.** Pointer-events pass through the card's surrounding area — user can pan/zoom/drop without dismissing first.
- Per-board state: dismissal is remembered per `boardId` in localStorage (`bench:orienting-card-dismissed:<boardId>`). The card should not reappear if the user clears a board back to zero.

Copy register: the word **tutorial**, **guide**, and **welcome** are banned from this surface. "An empty board." reads as a library shelf-label, not an instruction.

---

## §4 — Source drawer empty states (per tab)

Each drawer tab shows its own empty-state copy when the tab has no query and no recent results. Copy below is final; stringly-typed map in `source-drawer.tsx`:

| Tab | Copy |
|---|---|
| Verses | **Search a reference, like "John 3:16" or "Gen 1".** |
| Entities | **Search a name — Ruth, Paul, Pilate.** |
| Lexicon | **Search a Greek or Hebrew word. Or a Strong's number.** |
| Cross-refs | **Enter a reference. You'll get the refs that fan from it.** |
| Notes | **Your notes from reading land here. Search a phrase, a word, a book.** |
| Studies | **Your own studies are here too. Search a title or a theme.** |

### Recent list

Below the empty copy, a small **Recent** header (12px, uppercase-tracked, stone-700) and the user's last 5 interactions on that tab. Stored client-side at `localStorage['bench:recent:<tab>']` as `string[]` (most-recent-first, max 5). Entries are plain strings for Verses/Cross-refs (references), labels for everything else. Clicking an entry re-runs the query.

No "clear" button in this phase. If the list is empty, the Recent header is not rendered.

---

## §5 — Recent Clips tray empty state

> **Nothing here yet.**
>
> **When you clip from a study you're reading, it lands here.**

Followed by a single 12px italic line, stone-700 @ 0.75:

> *You can also drag straight from the left rail — clips are optional.*

The italic is the parenthetical voice — lower-register, aside, *not* a second instruction.

---

## §6 — First-connection celebratory micro-moment

**Trigger:** the user's first successful connection draw on any board. Fires once per user (server-side flag `preferences_flags.first_connection_drawn`). On release:

1. Connection stroke draws in with the usual 160ms `stroke-dashoffset` motion (per 32a §9).
2. Then a sage-500 aura (6px blur, 40% opacity) pulses along the curve for **240ms** then fades to 0.
3. Server `PATCH /api/user/bench-flags` sets the flag. If the request fails, the flag is considered set anyway — we never want a user to see this pulse twice because of a network blip; the worst case is they miss it once, which is fine.

**No toast, no modal, no text.** The pulse is the entire reward.

Governing rule, restated: if a reader would find this annoying on the tenth board, it shouldn't exist. One 240ms aura is on the right side of that line; any more would not be. No confetti. No sparkle. No sound.

`prefers-reduced-motion`: skip the aura entirely. The connection still draws.

---

## §7 — Keyboard cheat-sheet modal

Triggered by `?` anywhere on a board page. Two columns:

**Canvas**
- Pan — `Space` + drag
- Zoom — `⌘` + wheel
- Reset view — `F`
- Lasso-select — drag on empty canvas
- Duplicate — `⌘D`
- Delete — `Delete`
- Undo / Redo — `⌘Z` / `⌘⇧Z`
- Nudge — arrows (`⇧` = 32px)
- Open expanded — `Enter`
- Close / escape — `Esc`

**Workflow**
- New clipping from drawer — `/`
- Search current drawer tab — `⌘K`
- Toggle drawer — `[`
- Toggle tray — `]`
- Save snapshot — `⌘S` *(disabled — reserved)*
- Help — `?`

Typography: label in 13px reader-body, stone-700. Keys in `tabular-nums` 13px monospace inside stone-100 chips with stone-200 hairlines. No icons. No footer text.

Motion: fade-in 180ms, `ease-out`. Escape closes.

Implementation note: the `?` handler plugs into the existing `onKeyDown` in `components/bench/canvas.tsx` (around the current Space/⌘0 block). Guard against firing inside an `<input>` or `<textarea>`. The cheat-sheet component lives at `components/bench/keyboard/cheat-sheet.tsx`.

---

## §8 — Mobile banner

Per 32a §11 — at small viewports the canvas renders read-only with a sticky banner. Copy **replaces** the current `MobileNotice` strings:

> **Study Bench boards read best on desktop.** **Editing is disabled at this size. Your clips from reading still work.**

Styling stays as currently implemented in `components/bench/empty-states.tsx:31` (ivory-paper fill, stone-200 border, 36px tall). The banner dismiss (×) is session-scoped only.

**Follow-up (not in 35a scope):** the current banner shows at `md:hidden` (<768px), but 32a §11 specifies <900px. Reconcile in a separate ticket — the breakpoint should be 900px to match the point at which the canvas becomes genuinely unusable.

---

## §9 — Copy voice audit

Every copy block above has been read aloud. None contain: *journey*, *explore your faith*, *dive in*, *unlock*, *welcome* (except Step 1 where it is used once as a greeting, not a verb), *tutorial*, *guide*, *level up*, *dive deeper*, *engage with*, *embark*, *empower*. None apologize for absent features. None explain what a visible feature is.

Grep check to run on this file at review time:

```
rg -n 'journey|dive in|unlock|explore your faith|level up|dive deeper|embark|empower' founders-files/brief-35a-plan.md
```

Expected: zero matches.

(*"Welcome to your bench."* in §1 Step 1 is the one permitted "welcome." The cliché is "welcome to [thing you are about to teach]" — here it names the room, not a lesson. If this reads wrong in voice review, the fallback is **"Your bench."** — two words, same effect.)

---

## §10 — Persistence

Two flags, both server-side, account-level:

- `bench_intro_seen: boolean`
- `first_connection_drawn: boolean`

Stored in a single JSON column on the existing `users` table: `preferences_flags JSONB NOT NULL DEFAULT '{}'`. Future bench/app flags reuse this column; do not add one-off boolean columns per flag.

### §10.A Migration note

This stack is **better-sqlite3**, not Drizzle/Postgres. Migrations are expressed as a `SCHEMA_VERSION` bump plus an additive `ALTER TABLE` in `app/lib/db/schema.ts` / `connection.ts` (existing pattern — see `SCHEMA_VERSION = 12`). SQLite has no `jsonb`; store JSON as `TEXT` and parse on read.

- Bump `SCHEMA_VERSION` (currently 12 → 13) in `lib/db/schema.ts`.
- Add to the `users` table definition:
  ```sql
  preferences_flags TEXT NOT NULL DEFAULT '{}'
  ```
- Add the corresponding `ALTER TABLE users ADD COLUMN preferences_flags TEXT NOT NULL DEFAULT '{}';` in the version-13 migration block in `connection.ts` so existing rows pick up the default. No backfill script needed — the column default covers every existing row.
- Read path: `JSON.parse(row.preferences_flags ?? '{}') as Record<string, boolean>`. Absent keys read as `undefined` → treated as not-seen / not-drawn.
- Write path: read → merge → `JSON.stringify` → parameterized `UPDATE`. Never concatenate.
- API: `app/api/user/bench-flags/route.ts` exposes `GET` (returns the parsed object) and `PATCH` (accepts `{ key: string; value: boolean }`, whitelists keys to `bench_intro_seen | first_connection_drawn`). `requireAuth()` first, rate-limited. One `GET` on `/bench` mount; one `PATCH` per flag set.
- Existing `users.onboarding_completed` stays as-is — it's global app onboarding, not bench-specific. Do not overload it.

---

## §11 — Verification

A new user walking through `/bench` → first board → first connection experiences:

1. The intro once (three steps, dismissable).
2. The orienting card once per board (per-board localStorage).
3. The celebratory pulse once, ever.

A return visit the next day shows none of these.

Additional checks:

- Every empty-state copy block reads aloud as voice-consistent with the reader. Review this document out loud before approving.
- The `?` modal opens instantly on every board page and closes on Escape. Keys render in `tabular-nums` monospace.
- `prefers-reduced-motion` on: no aura, no fade-up translate; opacity-only transitions.
- Network tab on fresh `/bench` load: exactly one `GET /api/user/bench-flags`. After dismissing intro: exactly one `PATCH`. After drawing first connection: exactly one `PATCH`. No polling.
- Mobile viewport: banner shows the new copy. Clips from reading still land in the tray (tray is read-only but present).

---

## Acceptance

- Plan approved.
- Every copy block is final (not TODO).
- Coach-mark flow is drawable as a three-step storyboard (see §1.A).
- The celebratory-pulse decision is explicit and restrained: one 240ms sage-500 aura, no confetti, no toast, skipped under reduced-motion.
