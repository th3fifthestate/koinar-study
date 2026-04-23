# Brief 32a — Study Bench: Canvas Design Spec

> **Scope.** This document authors the visual and interaction design of the Study Bench canvas — the surface at `/bench` and `/bench/[boardId]`. It follows Brief 30 (direction) as source of truth for philosophy, clipping types, and compliance commitments. It is the sole design input for Brief 32b (Sonnet, implementation) and Brief 34a (templates design). Every number, color, duration, and word of copy in this doc is final; 32b copies descriptors, not redesigns.
>
> **Out of scope.** Data model (Brief 32b). Template layouts (Brief 34a). License meter chip wiring logic (Brief 34b). Reader Clip-to-Bench affordances (implemented by Brief 33, but the receiving Recent Clips tray is designed here).
>
> **Voice anchor.** Continuous with the reader: warm paper, sage/stone/warmth palette, editorial motion in the 120–240ms band. A library table, not a diagramming tool. The copy in this doc is final, non-cheesy, non-didactic — a new user should feel oriented without being talked down to.

---

## 1. Canvas visual language

### 1.1 Background

The canvas background **is the reader's paper surface, ported verbatim**. This is non-negotiable for voice continuity — a "table-surface" treatment (felt, wood, dimensional mat) would read as a break from reading, which is the wrong signal when the Bench is supposed to extend the reading muscle.

Concrete spec:

- The canvas plane is wrapped in a `ReaderSurface` identical to the reader's — same `data-reader-surface` component at [app/components/reader/reader-surface.tsx:34](app/components/reader/reader-surface.tsx). Time-of-day palette (dawn/morning/midday/golden/evening/night) drives `--reader-paper`, `--reader-ink`, `--reader-accent-*` CSS variables. Board load picks the user's current local hour bucket once; the surface does not shift mid-session.
- Paper grain: same fractal-noise SVG baked to a data URI, 320×320 tile, `baseFrequency="0.85"`, `numOctaves="2"`, `stitchTiles="stitch"`. Opacity `0.55` light / `0.38` dark, `mix-blend-mode: multiply` light / `overlay` dark. The grain is *fixed* to the canvas container, not to the camera transform — i.e. the grain does not scale or pan with the board; it stays paper-pinned to the viewport as the user moves around. This reads as "looking across a paper surface through a framed viewport," which is the correct mental model.
- Tonal wash: identical four-radial-gradient layer from [reader-surface.tsx:91](app/components/reader/reader-surface.tsx). Also fixed to the viewport, pointer-events disabled, sits behind content.
- No board-level color variant. Boards do not have themes. A word-study board and a character-study board render on the same surface — the clippings are the color.

### 1.2 Optional dot grid

A faint dot grid renders at ≥100% zoom and fades as the user zooms out:

- Visible opacity: `0.10` at `zoom ≥ 1.0`.
- Linear fade: opacity drops to `0` across zoom `1.0 → 0.6`.
- Hidden: `zoom < 0.6`.
- Dot spec: 2px circle, color `var(--stone-300)`. Spacing: 32px in canvas units (i.e. the dot density is anchored to the canvas plane — at zoom 0.5× the dots are 16px apart on screen, at zoom 2× they are 64px apart).
- Implementation: a CSS background-image on the transform plane (`radial-gradient(var(--stone-300) 1px, transparent 1px)` with `background-size: 32px 32px`).
- The grid is never a snap target by default (see §4). It is an optical rhythm aid, not a structural constraint.

### 1.3 Zoom

- Range: `0.25× to 2×`. Tightened from Brief 30 §3.1's 0.25×–4× — a 4× ceiling invites the user to over-zoom into one card, which is the wrong Bench interaction. The right interaction at one card is *expand*, not *zoom*. 2× covers legibility on a high-density board; anything tighter, use expand.
- Controls: scroll-wheel pinch with `Cmd/Ctrl` held (macOS trackpad gesture-change supplements), `Cmd/Ctrl + +/-` keyboard, `Cmd/Ctrl + 0` to fit board to viewport, `Cmd/Ctrl + 1` to jump to 100%. Zoom center-of-cursor (not center-of-viewport).
- Visual feedback: no zoom percentage display. The canvas just zooms. (A persistent "85%" chip would break the library-table feel.)

### 1.4 Pan

- Controls: `Space + drag` (cursor becomes `grabbing`), middle-mouse drag, two-finger trackpad drag (without modifier) when the cursor is over empty canvas.
- Keyboard: arrow keys pan 64px per press; `Shift + arrow` pans 256px.
- Unbounded. There are no edges to the board. Clippings can be anywhere in `float`-valued canvas coordinates.
- Camera inertia: on pointer release after a fast flick (>800 px/s terminal velocity), the camera continues with `120ms` linear-decay drift. No inertia below that threshold — a slow pan releases exactly where the user let go. Rationale: a library table doesn't coast indefinitely; it rests.

### 1.5 Grain/grid layering order (bottom to top)

1. `ReaderSurface` base paper color (fill).
2. Radial tonal wash layer (fixed to viewport).
3. Paper grain (fixed to viewport).
4. Transform plane (the camera).
5. Dot grid (inside the transform plane).
6. Connection SVG layer (inside the transform plane).
7. Clipping cards (inside the transform plane).
8. Selection lasso overlay (screen-space, above cards but below chrome).
9. Chrome (top bar, rails) — outside the transform plane entirely.

---

## 2. Clipping card anatomy

Every clipping renders inside a common shell. Type-specific rendering fills the body; the shell is invariant.

### 2.1 Shell

- Corner radius: `10px`. (Matches `--radius` of `0.625rem` from [globals.css:43](app/app/globals.css). Not larger — soft but still reads as paper, not a pill.)
- Background: `#fdfaf3` at `opacity 0.94` over the surface — reads as warm ivory slightly lifted from the paper grain. This is a new token, `--ivory-paper`, added to `globals.css` alongside the existing palette. Dark-mode variant: `#3a362f` at `opacity 0.94` (matches the reader's dark `--card` at [globals.css:57](app/app/globals.css)).
- Border: `1px solid var(--stone-200)` (light) / `var(--border)` dark.
- Shadow (rest): `0 1px 2px rgba(44, 41, 36, 0.06), 0 0 0 1px rgba(44, 41, 36, 0.04)` — the low double-layer reads as a card resting on paper, not a floating panel.
- Shadow (hover): add `0 3px 10px rgba(44, 41, 36, 0.08)` above the rest shadow.
- Shadow (dragging): `0 8px 24px rgba(44, 41, 36, 0.14)` — the card lifts.
- Padding: `16px` top/bottom, `18px` left/right for default cards. Smaller types (lexicon, verse min) shrink to `12px/14px`.

### 2.2 Shell regions

Top to bottom:

1. **Type strip** (`20px` tall): left-aligned type badge + right-aligned overflow (kebab) button. Type badge: `11px font-sans`, `font-weight: 500`, `letter-spacing: +0.06em`, `text-transform: uppercase`, color `var(--sage-700)`. Content is `TYPE · QUALIFIER`, e.g. `VERSE · NIV`, `ENTITY · SUMMARY`, `LEXICON · GREEK`. Kebab is a 20px hit target, icon is `More-horizontal` lucide at 14px, color `var(--stone-700)`.
2. **Body** (flex-1): type-specific content. See §2.4.
3. **Footer strip** (`16px` tall, optional): citation / attribution text, `11px font-body`, color `var(--stone-700)` at `opacity 0.85`. Only rendered when the clipping has a citation obligation (licensed verse, lexicon source). Hidden for `user_note` and `study_section`.

### 2.3 User-label slot

Above the type strip, when the user has authored a `user_label`, a single line renders in `13px font-display italic`, color `var(--stone-900)`. Default (no user label): slot is absent; the type strip leads. The user label edits in place on double-click.

### 2.4 Per-type body rendering + dimensions

Dimensions are specified as `width × height` in canvas units at 100% zoom. The default is what drops onto the canvas from the source drawer or reader; the min is the smallest resize the corner handle allows.

| Type | Default | Min | Body render |
|---|---|---|---|
| `verse` | 300×140 | 220×96 | Reference header (`15px font-display`, e.g. "John 3:16"); verse body (`16px font-body`, line-height `1.55`, color `var(--reader-ink)`); translation chip at bottom-left of body (a `VERSE · NIV`-style badge doubles as the translation chip — no separate element needed). Re-renders from `verse_cache` live. |
| `entity_snippet` | 320×200 | 240×140 | Entity name (`17px font-display`, color `var(--reader-display)`) + entity type pill (`10px font-sans`, background `var(--sage-300)` at 0.5, color `var(--sage-700)`, e.g. `PERSON`, `PLACE`, `CONCEPT`); tier-specific body (tier-1: 2-line quick glance, `14px font-body`; tier-2: full summary with scrollable overflow capped at the card height, `14px font-body`). Expand chevron at bottom-right toggles tier-1 ↔ tier-2 inline. |
| `translation_compare` | 580×260 | 420×180 | Reference header centered at top; 2–4 equal-width columns below, each column: translation badge (`VERSE · NLT` style), verse text (`14px font-body`). Columns divided by `1px solid var(--stone-200)` rules. Horizontal scroll inside the card if adding a 5th translation — but 32a locks the cap at 4 (Brief 30 §2.3). |
| `cross_ref_chain` | 320×420 | 260×300 | Anchor verse at top as a mini scripture block; numbered list below, each row: reference (`13px font-display`, color `var(--sage-700)`, tabular figures), verse text one-line-clamped (`13px font-body`, color `var(--stone-700)`). Weight dots (•) at the right edge, count = TSK weight 1–5 if present. Scrollable inside the card when list overflows. "Expand all" link at the bottom (`11px font-sans`, color `var(--sage-700)`) swaps the card to tier-2 which removes the clamp. |
| `lexicon_entry` | 260×160 | 200×120 | Headword (`20px font-display`, color `var(--reader-display)`); transliteration (`12px font-sans italic`, color `var(--stone-700)`); gloss (`14px font-body`); "Read full entry →" tail link (`11px font-sans`, color `var(--sage-700)`) which opens the lexicon drawer. Footer shows "STEPBible · CC BY 4.0". |
| `user_note` | 300×180 | 220×120 | Markdown body (`14px font-body`, line-height `1.55`). Inline-edit on double-click — flips to a textarea with autosave. If the note is linked to an existing annotation, a small source chip ("From John 3 study") renders at the bottom-left of the body. |
| `study_section` | 500×380 | 380×240 | Study title (`13px font-sans uppercase tracked +0.04em`, color `var(--stone-700)`); section heading (`17px font-display`, color `var(--reader-display)`); excerpt body (`14px font-body`, first ~200 words, fades to transparent at the bottom 24px); "Open in study →" link (`12px font-sans`, color `var(--sage-700)`). |

Rationale on the dimension choices: verses are the densest type and read fine narrow; entity cards hold a paragraph so they default wider; translation-compare needs breadth for 3+ columns to breathe; cross-ref chains are lists and lean tall; study-section needs true reading width. The Brief 32a original defaults are mostly preserved; I widened `verse` from 280 to 300, widened `translation_compare` from 560 to 580 (to make three 180px columns cleanly fit with dividers), widened `study_section` from 480 to 500.

### 2.5 Color swatch (user-chosen)

Context-menu "Change color" sets `--card-accent` on the card. Four options, chosen to stay inside the Bench palette:

| Swatch | Token | Use |
|---|---|---|
| Default (no swatch) | `var(--ivory-paper)` fill, `var(--stone-200)` border | neutral |
| Sage | fill unchanged, border `var(--sage-300)`, left edge inset 3px stripe `var(--sage-500)` | "this matters" |
| Warmth | border `color-mix(in srgb, var(--warmth), var(--stone-200) 50%)`, stripe `var(--warmth)` | "come back to this" |
| Stone | border `var(--stone-300)`, stripe `var(--stone-700)` | "resolved / reference" |

The color is a band of three pixels on the left edge, not a full fill — fills would fight the paper. Swatch persists on the `clippings.color` column (Brief 30 §2.1).

### 2.6 Selection state

Selected card (single or multi): `box-shadow: 0 0 0 2px var(--sage-500)` outside the existing shadows; no fill change. The sage ring is the only selection affordance — no scale change, no corner handles appear on selected-only state. Corner handles appear only on hover-over-card and disappear on hover-out (to keep the card visually quiet at rest).

### 2.7 Resize handles

Eight handles (four corners + four edge midpoints) appear on hover. Each is a 6px circle, `var(--sage-500)` fill, `2px` white border. Cursor changes to the appropriate resize cursor (`nwse-resize`, `ew-resize`, etc.). On drag: the card resizes continuously with the pointer; autosave debounces 250ms after release.

### 2.8 Drag-to-connect edge zone

A 12px band along the card's outer perimeter (inside the card's bounding rect) is the drag-to-connect hit zone. On hover inside this band (when the pointer is over an edge, not the interior body), cursor becomes `crosshair` and a faint `var(--sage-300)` hairline outlines the card edge facing the cursor. Press-and-hold for 300ms, then drag — a ghost connection starts from the nearest edge midpoint. See §3 + §4.

---

## 3. Connection (arrow) visual

### 3.1 Render layer

A single `<svg>` element is positioned absolutely inside the transform plane, `pointer-events: none` at the root, with individual `<path>` and `<g>` elements promoted to `pointer-events: stroke` / `all`. One SVG per board; paths added/removed as connections are created/deleted. This keeps a single stacking context and means zoom/pan transforms apply uniformly.

The SVG layer sits below the clipping cards, above the dot grid.

### 3.2 Path geometry

**Cubic Bézier with modest sag.** Decision over elbow (too diagrammatic) and straight (too forceful in dense boards).

Given source card `S` and target card `T`, compute connection anchor points as the midpoint of whichever edge of each card is closest to the other card's center. Control points:

```
P0 = S.anchor
P3 = T.anchor
Δ  = P3 - P0
P1 = P0 + (Δ.x * 0.33, Δ.y * 0.08)   // sag toward source
P2 = P3 - (Δ.x * 0.33, -Δ.y * 0.08)  // sag toward target
```

The `0.33` longitudinal offset gives the curve enough breathing room without lazy S-curves. The `0.08` lateral sag reads as an editorial hand-drawn line — not rigid, not loopy.

Self-connections (S === T) render as a teardrop loop exiting top-right and returning top-left with a 56px radius in canvas units.

### 3.3 Stroke

- Default: `1.5px`, `var(--sage-500)`, `stroke-linecap: round`.
- Hover: `2px`, same color; the hover also enters *focus mode* — every non-connected card fades to `opacity 0.4` with a 160ms ease-out transition. Leaving hover restores opacity with a 200ms transition.
- Selected: same 2px, color shifts to `var(--sage-700)` (slightly more committed).
- Flagged (v1-deferred, token reserved): `var(--destructive)` red at 2px. The shell supports a `flagged` state but no UI surfaces the toggle in v1 — reserved for v1.1.

### 3.4 Arrowhead

A small filled triangle at the target end. 6px wide, 8px long, same fill color as the stroke. Rotates to match the Bézier tangent at `P3`. The arrow points *into* the target edge, not past it — compute the anchor with a 2px back-off so the tip sits cleanly on the target card edge.

### 3.5 Label pill

Labels render as a small pill attached to the Bézier midpoint (`t = 0.5`):

- Typography: `11px font-sans`, `font-weight: 500`, `letter-spacing: +0.02em`, color `var(--sage-700)`.
- Padding: `3px 8px`.
- Background: `--ivory-paper` (same as card fill) at `opacity 1.0` — needs to punch cleanly through the paper grain so the label reads.
- Border: `1px solid var(--sage-300)`.
- Radius: `999px` (full pill).
- Shadow: none. The label is paper-on-paper.
- Max width: 140px canvas units; text truncates with ellipsis past that. Full label text appears in the connection context menu on right-click.
- If no label was authored, nothing renders at the midpoint — the curve is bare.
- Max label length (input constraint): 60 chars (matches Brief 30 §3.1).

### 3.6 Drawing affordance (ghost connection)

During drag-to-connect:

1. Press-and-hold 300ms in the edge zone of source card — source card's nearest edge shows the hairline outline (§2.8).
2. On hold-threshold pass, the cursor becomes a closed-loop ring (`crosshair` with a `ring` overlay) and a *ghost path* starts: `1.5px dashed` (`4 3` dash pattern), `var(--sage-500)` at `opacity 0.6`. The ghost follows the pointer; it terminates at the pointer position with no arrowhead.
3. As the pointer enters any other card's edge zone, that card's edge shows the hairline outline and the ghost snaps to its nearest edge anchor. Release over a valid target: the ghost solidifies into a real connection; a label popover opens at the midpoint (small inline input, autofocused, placeholder `Label (optional)`; Enter commits, Escape dismisses — commits either way with whatever text is present).
4. Release over empty canvas or self: ghost fades out over 120ms. No connection created.
5. Escape during drag: ghost fades out; no connection created.

### 3.7 Connection selection + deletion

Click a connection's stroke (12px-wide invisible hit path widens the clickable area) → selects it. Selection visual: stroke shifts to `var(--sage-700)` + `2px`; label pill gains a `box-shadow: 0 0 0 2px var(--sage-500)` ring. Delete/Backspace removes the selected connection. Shift-click to multi-select connections + cards.

Right-click on a connection: context menu (Edit label, Delete, Flag [disabled in v1]).

---

## 4. Interaction spec

Interactions are specified with five attributes: **Trigger** · **Cursor** · **Visual feedback** · **Commit semantics** · **Undo behavior**. Every interaction below obeys `prefers-reduced-motion` per §10.

### 4.1 Canvas-level

| Action | Trigger | Cursor | Feedback | Commit | Undo |
|---|---|---|---|---|---|
| Pan | `Space + drag`; middle-mouse drag; two-finger trackpad drag on empty canvas | `grab` → `grabbing` | Camera moves 1:1 with pointer | Camera PATCH debounced 300ms after release | Camera changes are not part of the undo stack |
| Zoom | `Cmd/Ctrl + wheel`; macOS trackpad pinch; `Cmd/Ctrl + +/-`/`Cmd/Ctrl + 0`/`Cmd/Ctrl + 1` | unchanged | Camera zooms at pointer (wheel) or at viewport center (keyboard) | Camera PATCH debounced 300ms | Not undoable |
| Fit to board | `Cmd/Ctrl + 0` | unchanged | Camera animates to fit all clippings + 40px padding over 300ms `cubic-bezier(.2,.8,.2,1)` | Camera PATCH | Not undoable |
| Lasso select | Left-click-drag starting on empty canvas | `crosshair` | Dashed `1px var(--sage-400)` rectangle follows pointer (see §9 lasso motion) | Selection is ephemeral | N/A |
| Clear selection | `Escape`; click empty canvas | unchanged | Selection rings fade 120ms | Not persisted | N/A |
| Keyboard pan | Arrow keys (no focused card) | unchanged | Camera translates 64px (256px with Shift) | Camera PATCH after 300ms idle | Not undoable |
| Open keyboard cheat-sheet | `?` | unchanged | Modal opens (220ms panel-slide, §9) | N/A | N/A |

### 4.2 Clipping-level

| Action | Trigger | Cursor | Feedback | Commit | Undo |
|---|---|---|---|---|---|
| Select single | Click card body | `default` | Sage ring around card | Ephemeral | N/A |
| Add to selection | Shift+click | `default` | Ring added | Ephemeral | N/A |
| Move | Drag card body | `grab` → `grabbing` | Card lifts (drag-start motion, §9); position tracks pointer 1:1 | PATCH debounced 250ms after release | ✓ undoable (stack depth 20) |
| Multi-move | Drag any selected card | `grabbing` | All selected cards lift and translate together | One PATCH per card after release | ✓ as a single undo frame |
| Resize | Drag corner or edge handle | type-specific resize cursor | Card resizes continuously; connection paths re-route live | PATCH debounced 250ms after release | ✓ |
| Expand | Double-click body | `default` | Card swaps tier-1 ↔ tier-2 with a 200ms crossfade | No PATCH (view-only state, not persisted) | Not undoable |
| Inline-edit label | Double-click user-label slot (or, if absent, double-click card with `Alt`) | `text` | Input replaces label text; `Enter` commits, `Escape` cancels | PATCH on blur or Enter | ✓ |
| Context menu | Right-click card | `default` | Popover appears at pointer, 160ms enter (§9) | N/A | menu actions each have their own undo behavior |
| Duplicate | `Cmd/Ctrl + D`; context menu | `default` | Duplicate appears 16px down + 16px right of source; selected | POST new clipping | ✓ |
| Delete | `Delete`/`Backspace` on selection; context menu | `default` | Selected cards + their incident connections fade 160ms and disappear | DELETE each | ✓ |
| Bring forward / send back | `]` / `[`; context menu | `default` | Z-index updates; no motion | PATCH `z_index` | ✓ |
| Change color | Context menu → swatch | `default` | Left-stripe animates in, 160ms | PATCH `color` | ✓ |
| Copy verse reference | Context menu (verse type only) | `default` | Toast: "Copied John 3:16" (160ms enter, 1400ms visible, 160ms exit) | Clipboard write (subject to CopyGuard) | N/A |

### 4.3 Connection-level

| Action | Trigger | Cursor | Feedback | Commit | Undo |
|---|---|---|---|---|---|
| Draw | Press-hold 300ms in source edge zone, drag, release on target | `crosshair` | Ghost path → solid + label popover | POST connection on release | ✓ |
| Cancel draw | Release on empty canvas or self, or `Escape` during drag | `default` | Ghost fades 120ms | No commit | N/A |
| Edit label | Click label pill, or right-click → Edit | `text` | Popover opens at pill with current label | PATCH on Enter or blur | ✓ |
| Select | Click stroke | `default` | Stroke thickens, label ring | Ephemeral | N/A |
| Delete | `Delete`/`Backspace` with connection selected; context menu | `default` | Stroke + label fade 160ms | DELETE | ✓ |
| Hover focus-mode | Hover stroke | `default` | Non-connected cards fade to 0.4 opacity over 160ms | Ephemeral | N/A |

### 4.4 Keyboard: tab navigation inside the canvas

- Tab order: top bar → rails → canvas cards in creation order (oldest first). Shift+Tab reverses.
- Focus on a card: sage 2px ring at 2px offset (standard `--ring`), no layout shift.
- Arrow keys on a focused card: nudge 8px per press; `Shift + arrow` = 32px.
- Enter on a focused card: opens the card's expanded view (double-click equivalent).
- `Space` on a focused card: toggles selection.
- `Delete`/`Backspace` on focused + selected card: deletes (with undo).
- `Cmd/Ctrl + A`: select all cards *currently visible in viewport* (not off-screen). Justification: an 80-clipping board would drown the user if Ctrl+A selected all; viewport-scoped is the safe default. Off-viewport select-all requires `Cmd/Ctrl + Shift + A` (not documented in the cheat-sheet for v1 — power-user hidden).
- Snap-to-grid: hold `Shift` while dragging a card → card position snaps to the 8px grid continuously during drag. Release to drop. Matches Brief 30 §3.2. Default drag behavior (no Shift) is free placement — no snap.

### 4.5 Undo stack semantics

- Depth 20, in memory only. No persistence across tab close / refresh.
- `Cmd/Ctrl + Z` → undo; `Cmd/Ctrl + Shift + Z` → redo.
- Operations that push a frame: move, resize, delete, duplicate, add connection, delete connection, edit label (card or connection), change color, bring-forward/send-back. Each frame includes the inverse operation payload.
- Operations that do NOT push: camera pan/zoom, selection changes, tier-1/tier-2 expand, hover focus-mode, keyboard cheat-sheet open/close.
- Multi-card operations (multi-move, multi-delete) push a single frame containing the whole group — one Ctrl+Z undoes the whole move.

---

## 5. Top bar

Sticky at the top of the `/bench/[boardId]` viewport. 56px tall. Does not scroll with the canvas. Sits above the canvas transform plane. Bottom edge: `1px solid var(--stone-200)` with a 1px `rgba(44, 41, 36, 0.04)` inner shadow to lift it off the paper.

### 5.1 Left cluster

- Breadcrumb chevron (`chevron-left` lucide, 16px, `var(--stone-700)`) → back to `/bench`.
- Board title. Rendered as a `19px font-display` inline-editable text. Click to edit; Enter commits; Escape reverts. Placeholder when untitled: `Untitled board` in `var(--stone-300)`. Max 80 chars.

### 5.2 Center cluster

- Question field. `15px font-body italic`, color `var(--stone-700)`, placeholder `What are you studying?` in `var(--stone-300)`. Inline-edit on click; Enter commits. Max 140 chars. This is the single highest-value text field in the surface; it is centered because the question, not the title, is what the user returns for.

### 5.3 Right cluster

- License meter chips (see Brief 30 §8; visual wired by Brief 34b). At 32a this position reserves a fixed 280px rightward of center — chips flow left-to-right, right-aligned.
- Board kebab menu (`More-horizontal`, 20px hit target):
  - Rename board (focuses the title field)
  - Duplicate board
  - Archive board
  - Export note *(disabled, tooltip: "Export is in the roadmap.")*
  - Copy board link *(copies `/bench/[boardId]` URL)*

### 5.4 Motion

- The top bar fades in on first paint over 240ms `ease-out` (see §9 `chrome-mount`).
- Inline-edit flip (title/question): input replaces the static text in-place; no transition — the cursor lands instantly in the editable field. Blur commits with no animation. Rationale: inline edit is frequent, and animation here reads as lag.

---

## 6. Left rail — Source drawer

### 6.1 States

- Collapsed (default on first visit): 48px wide, icon rail on the surface's left edge. Chevron-right icon on hover enables expand.
- Expanded (user has explicitly opened): 320px wide.
- Persistence: `localStorage` keyed `bench:source-drawer-open` (boolean).

### 6.2 Collapsed rail

Four icons stacked at 16px top-padding intervals:

- `search` (16px) — click to expand and focus the search field
- `filter` (16px) — click to expand; opens filter tab ("Filter by type")
- `clock` (16px) — click to expand; opens "Recent sources" tab
- `book` (16px) — click to expand; opens "My notes" tab

Icons: `var(--stone-700)`, hover `var(--sage-700)`, 40px hit target (48×40 tap region).

### 6.3 Expanded rail

Top: search input, 32px tall, `14px font-body`, placeholder `Search verses, entities, lexicon…`. Debounced 200ms. Left icon inside: `search` glyph. Right icon: `x` clear (appears when input has text). Keyboard: `Cmd/Ctrl + K` focuses this input from anywhere on the canvas.

Below input: tab row, 6 tabs. Each tab is text-only (`12px font-sans`, letter-spacing `+0.04em`, uppercase), active tab underlined with a 2px `var(--sage-500)` bar:

1. `Verses`
2. `Entities`
3. `Cross-refs`
4. `Lexicon`
5. `Studies`
6. `Notes`

Below tabs: result list. Scrollable. Each result is a draggable mini-card.

### 6.4 Result mini-card anatomy

- Height: 56px (2-line results) or 72px (3-line for verses + entities).
- Hover: background `var(--sage-300)` at opacity 0.15, `cursor: grab`.
- Pressed (dragging): `cursor: grabbing`, card lifts (same motion as a canvas card on drag-start, §9).
- Content (one example per type):
  - Verse: ref (`12px font-display`, bold), snippet first 10 words (`13px font-body`, color `var(--stone-700)`), translation chip (`10px font-sans`).
  - Entity: name (`14px font-display`), type pill (`10px`), one-line glance.
  - Cross-ref: anchor ref + "→ N refs".
  - Lexicon: headword + gloss.
  - Study: title + section count.
  - Note: excerpt first line + source study.

Drag from result to canvas spawns a real clipping at the drop position.

### 6.5 Per-tab behaviors

- `Verses`: search within the board's default translation. Show top 20 results by match score; pagination on scroll-bottom (load 20 more).
- `Entities`: search `canonical_name` + aliases. Groups: "People", "Places", "Concepts". Each group headed with a small `11px font-sans uppercase` label.
- `Cross-refs`: takes a reference (e.g. `John 3:16`) and returns the TSK chain. Empty input: placeholder guidance text.
- `Lexicon`: search headword, gloss, or Strong's number. Hebrew/Greek sort toggle at top-right.
- `Studies`: the user's own studies + official Bible books they've opened. Search by title.
- `Notes`: the user's annotations + freeform notes. Chronological by default, sort toggle ("Newest · Oldest · By reference").

### 6.6 Empty states (in-drawer)

Each tab with no query entered shows a "What's here" block with one-line copy (see §8 for full copy).

---

## 7. Right rail — Recent Clips tray

### 7.1 States

- Collapsed (default): 48px wide, one icon (`layers`).
- Expanded: 280px wide.
- Persistence: `localStorage` keyed `bench:recent-clips-open`.

### 7.2 Expanded rail contents

- Header: `11px font-sans uppercase`, text `Recent clips`, followed by a count pill (e.g. `3`). Color `var(--stone-700)`.
- Subhead: `12px font-body italic`, color `var(--stone-700)` at 0.8, text: *"Clipped from the reader — drag onto the table to place."* Shown only when the tray has ≥1 clip.
- List: newest-first. Each entry is a draggable mini-card (same anatomy as §6.4):
  - Thumbnail / type icon (24px)
  - Source hint (which study, which reference, relative time — "John 3 · 2h ago")
  - Hover: subtle highlight + a trailing `x` dismiss button
- Drag onto canvas: places the clipping, removes the tray entry.
- Click the trailing `x`: sends the entry to "Dismissed" (recoverable for 30 days via the tray's overflow menu, which exposes a "Show dismissed" toggle — v1.1 recovery UI; in v1 the dismiss is soft-delete only, recovery surfaced in 34b).
- Overflow menu at bottom of the tray: "Clear dismissed", "Auto-place on active board" toggle (matches Brief 30 §4.3 `auto_place_on_active_board` flag; default OFF).

### 7.3 Empty state (in-tray)

Renders a short copy block + a `clock` glyph. See §8 for copy.

---

## 8. Empty states — final copy

Copy is final. No "TODO"s. Voice: terse, warm, non-didactic. No imperative cheer ("Let's get started!"), no second-person pep. Short declarative sentences. The user is an adult doing real work.

### 8.1 `/bench` dashboard with zero boards

Rendered centered on a paper surface, 480px max width.

```
A blank library table.

Every board is one question — you bring it, the Bench
helps you arrange the sources around it.

[ + New board ]
```

- Title: `32px font-display`, color `var(--reader-display)`.
- Body: `15px font-body`, line-height `1.55`, color `var(--reader-ink)` at 0.85.
- CTA: standard primary button (sage fill, ivory text).

### 8.2 A new board with zero clippings

A centered guide in the empty canvas. Fades out when the user drops their first clipping (160ms ease-out).

```
Start here.

Drag a verse, entity, or note from the left rail —
or clip something while reading a study.
```

- Title: `26px font-display italic`, color `var(--reader-display)` at 0.9.
- Body: `14px font-body`, color `var(--reader-ink)` at 0.8.
- Beneath the body: a subtle `chevron-left` (18px, `var(--sage-500)`) pointing to the left rail, with a faint pulse (2s ease-in-out loop, opacity 0.5 ↔ 0.9). Stops on first clipping.

### 8.3 Source drawer — no query entered

Shown in any tab when the search field is empty. One block, per tab:

- Verses tab:
  > *Search a reference (John 3:16) or a word. The verses here come from your default translation; switch on any clipping.*
- Entities tab:
  > *People, places, and ideas — the wrapped terms from studies and reader. Search by name; filter by kind.*
- Cross-refs tab:
  > *Enter a reference to pull its cross-reference chain (from the Treasury of Scripture Knowledge).*
- Lexicon tab:
  > *Hebrew and Greek headwords. Search by word, gloss, or Strong's number.*
- Studies tab:
  > *The studies you've opened. Drag a section to lay it on the table.*
- Notes tab:
  > *Your annotations and freeform notes. Keep an argument from one study; continue it on another.*

Typography: `13px font-body italic`, color `var(--reader-ink)` at 0.75, 14px padding, 180px max width.

### 8.4 Recent Clips tray — nothing clipped yet

```
Clips land here.

Clip a verse, entity, or passage while reading
— come back and lay it on a board.
```

- Heading: `14px font-display`, color `var(--reader-display)` at 0.9.
- Body: `12px font-body`, color `var(--reader-ink)` at 0.75, line-height `1.5`.
- Beneath the body: a subtle `clock` glyph (14px, `var(--sage-500)` at 0.6).

### 8.5 First-run orientation (one-time panel on first `/bench` visit)

A 340px-wide floating panel in the top-right of the `/bench` dashboard, 220ms panel-slide in (§9), dismissible. Keyed to `localStorage:bench:first-run-seen`. Appears exactly once.

```
The Study Bench

Every board is one question.
Drag sources from the rail.
Draw arrows to show how they fit.

[ Got it ]
```

- Card style: `--ivory-paper` fill, `var(--stone-200)` border, soft shadow.
- Title: `15px font-display`, color `var(--reader-display)`.
- Body: `13px font-body`, color `var(--reader-ink)` at 0.85, three short lines.
- CTA: text-button, `13px font-sans`, color `var(--sage-700)`.

---

## 9. Motion language

All durations reuse or extend [app/lib/motion/reader.ts](app/lib/motion/reader.ts). New entries below mark the vocabulary extension the Bench adds — each reused where it makes sense, each justified where it's new. Every row includes a `prefers-reduced-motion` fallback.

### 9.1 Motion table

| Name | Trigger | Duration | Easing | Property | Reduced-motion fallback | Source |
|---|---|---|---|---|---|---|
| **card-enter** | New clipping placed (drop from rail, duplicate, paste, undo-restore) | 200ms | `cubic-bezier(.2,.8,.2,1)` | opacity 0→1; transform translateY(8px)→0 | opacity 0→1 only, 1 frame | New (reader's popover-enter 160ms + 40ms settling) |
| **card-drag-start** | Mouse-down on card body, pointer moves ≥3px | 120ms | `ease-out` | transform scale 1→1.02; box-shadow rest→drag | no transform, shadow change snaps | Reuses `READER_MOTION_POPOVER_DRAG_SNAP` |
| **card-drag-end** | Pointer-up after drag | 120ms | `ease-out` | transform scale 1.02→1; box-shadow drag→rest | shadow snaps | same |
| **card-resize** | During resize drag | continuous (no transition) | n/a | width/height track pointer 1:1 | same | n/a |
| **card-expand** | Double-click, tier-1 ↔ tier-2 | 200ms | `ease-in-out` | crossfade (opacity) + height resize | crossfade only | New (same 200ms as `READER_MOTION_FONT_SIZE_APPLY`, same feel of a content swap) |
| **card-delete** | Delete key or menu | 160ms | `cubic-bezier(0.4, 0, 1, 1)` | opacity 1→0; transform scale 1→0.98 | opacity only | Reuses `READER_MOTION_POPOVER_EXIT` curve |
| **card-focus-fade** | Connection-hover focus mode enter | 160ms | `ease-out` | opacity 1→0.4 on non-connected cards | opacity snap | New (matches connection enter) |
| **card-focus-unfade** | Connection-hover focus mode exit | 200ms | `ease-out` | opacity 0.4→1 | opacity snap | New (slightly slower to ease back in) |
| **connection-draw-solidify** | Ghost → real connection on drop | 160ms | `cubic-bezier(.2,.8,.2,1)` | stroke-dashoffset animates from full to 0 + dash array collapses | stroke appears immediately | New (editorial: reuses reader's popover-enter curve) |
| **connection-ghost-fade** | Cancel connection draw | 120ms | `ease-out` | opacity 0.6→0 | opacity snap | Reuses `READER_MOTION_POPOVER_EXIT` duration |
| **connection-label-reveal** | Label committed after draw | 160ms | `cubic-bezier(.2,.8,.2,1)` | opacity 0→1; transform scale 0.96→1 | opacity only | Reuses reader popover-enter spec |
| **connection-delete** | Connection removed | 160ms | `ease-out` | opacity 1→0; stroke-dashoffset 0→full | opacity only | New |
| **panel-slide** (drawer/tray/first-run) | Rail expand, first-run panel enter | 220ms | `ease-out` | transform translateX(±100%→0); opacity 0→1 | opacity only, 1 frame | New (between reader popover-enter 160 and 240 TOC-fade — editorial but committed) |
| **panel-slide-exit** | Rail collapse, first-run dismiss | 180ms | `cubic-bezier(0.4, 0, 1, 1)` | transform translateX(0→±100%); opacity 1→0 | opacity only | New (reader popover-exit 120 + 60 for larger surface) |
| **lasso-draw** | Drag on empty canvas | continuous (no transition) | n/a | SVG rect tracks pointer 1:1 | same | n/a |
| **selection-ring** | Click selects card | 140ms | `ease-out` | box-shadow 0→2px `var(--sage-500)` | shadow snaps | New (shorter than card-enter because selection is frequent) |
| **selection-ring-out** | Selection cleared | 120ms | `ease-out` | shadow fade-out | snaps | same |
| **context-menu-enter** | Right-click | 160ms | `cubic-bezier(.2,.8,.2,1)` | opacity 0→1; transform translateY(-4px)→0 + scale 0.97→1 | opacity only | **Reuses `READER_MOTION_POPOVER_ENTER` exactly** |
| **context-menu-exit** | Menu dismiss | 120ms | `cubic-bezier(0.4, 0, 1, 1)` | inverse | opacity only | **Reuses `READER_MOTION_POPOVER_EXIT` exactly** |
| **chrome-mount** | Top bar fade-in on first paint | 240ms | `ease-out` | opacity 0→1; translateY(-4px)→0 | opacity only | **Reuses `READER_MOTION_TOC_GLIDER_FADE_IN`** |
| **toast-enter** | Copy-verse-ref toast appears | 160ms | `cubic-bezier(.2,.8,.2,1)` | opacity 0→1; translateY(4px)→0 | opacity only | Reuses reader popover-enter |
| **toast-exit** | Toast dismisses | 180ms | `ease-out` | opacity 1→0 | opacity only | New (180 rather than 120 to soften exit) |
| **cap-modal-shake** | User attempts clip past NIV cap | 320ms | `cubic-bezier(.36,.07,.19,.97)` | transform translateX sequence: -6, 6, -4, 4, -2, 2, 0 | no shake; modal appears with opacity only | New (editorial shake; paired with cap-hit modal, wired by 34b) |
| **fit-to-board** | `Cmd/Ctrl+0` | 300ms | `cubic-bezier(.2,.8,.2,1)` | camera transform animates to fit | snaps to final | New (reader's editorial curve extended for camera motion) |
| **zoom-step** | `Cmd/Ctrl + +/-` | 180ms | `ease-out` | camera zoom animates | snaps | Matches `READER_MOTION_TOC_GLIDE` |
| **camera-pan-inertia** | Release after fast flick | 120ms | `linear-decay` (custom) | camera drifts and decelerates | no inertia; release is the final position | New (short, explicit, bounded) |

### 9.2 Motion principles (summary)

1. **Durations live in two bands.** Micro-feedback (120–200ms) and panel transitions (180–240ms). Nothing in the Bench runs longer than 320ms except `fit-to-board` camera animation.
2. **Easing vocabulary is the reader's.** `cubic-bezier(.2,.8,.2,1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits, `ease-out` for micro-settles, `ease-in-out` for two-state swaps.
3. **Never linear.** Matches UI-GUIDELINES. Exception: the camera-pan-inertia decay, which is an explicit custom decay curve.
4. **`prefers-reduced-motion: reduce` strips transforms and retains opacity transitions capped at 1 frame.** No motion, no layout shift, full state-change feedback via color/opacity only.

---

## 10. A11y

### 10.1 Keyboard reachability

Every canvas interaction has a keyboard path. Tab order is deterministic:

1. Skip-link: "Skip to canvas" (screen-reader-visible, focus-visible).
2. Top bar: breadcrumb → title → question field → license meter chips (each focusable) → kebab.
3. Left rail (if expanded): search field → tab row → result list.
4. Canvas cards in creation order (oldest first).
5. Connections (each focusable as a group with their endpoints; see §10.4).
6. Right rail entries.

Visited focus receives the standard focus ring: `2px solid var(--ring)` (`var(--sage-500)` per [globals.css:37](app/app/globals.css)) with `2px` offset, no outer box-shadow blur.

### 10.2 ARIA labeling

Every clipping card gets an `aria-label` following this template:

```
{type} clipping · {primary label} · position row {R} column {C}
```

Where `row` and `column` are derived from a deterministic grid projection of the current card layout (viewport-sized 4×3 grid, cards assigned to the cell their center lands in). Examples:

- `Verse clipping · John 3:16, NIV · position row 2 column 3`
- `Entity clipping · Abraham, person · position row 1 column 1`
- `User note clipping · "Why does Hebrews echo Exodus 34?" · position row 3 column 4`

The grid projection is for screen-reader orientation only; it does not render visually.

### 10.3 Live regions

- Camera changes (pan/zoom): not announced. Would be spam.
- Clipping add/delete: `aria-live="polite"` region announces: `Added verse clipping: John 3:16` / `Removed 2 clippings and 1 connection`.
- Cap-hit (from 34b, reserved): `role="alert"` on the cap modal.

### 10.4 Screen-reader narrative for connections

Each connection is a focusable element with:

```
<g role="group" aria-label="Connection from {source.label} to {target.label}
  labeled '{label}'. {n} of {total} on this board.">
```

Where `{label}` is `unlabeled` if the user didn't type one. Tab navigates across connections after cards; Enter on a connection opens its label-edit popover.

### 10.5 `prefers-reduced-motion`

Media query respected throughout. Under reduce:

- All transforms removed.
- All durations clamped to ≤60ms (effectively one frame).
- Opacity transitions retained — state change is still communicated visually.
- Camera inertia disabled; pan/zoom commit instantly on input release.
- Card-drag-start scale lift suppressed; shadow still deepens (state feedback via depth, not motion).

### 10.6 Contrast

All text on card body meets WCAG 2.2 AA:

- `var(--reader-ink)` on `--ivory-paper`: contrast ratio ≥7:1 in all six time-of-day buckets (verified in 28-series work; reused here).
- Type badges (`var(--sage-700)` on ivory): ≥4.5:1.
- UI chrome minimum: 3:1 (buttons, dividers).

Color is never the sole information carrier. Selection uses a ring *and* the cursor-target implication; connection flagged state (when it ships) pairs red stroke with an icon adornment.

### 10.7 Pointer-size comfort

All interactive chrome targets are ≥24×24 CSS px. Card resize handles are 24×24 hit regions (rendered as 6×6 dot centered inside that region). Touch/coarse pointers are out of scope — below 900px the canvas is read-only (§11).

---

## 11. Responsive behavior

### 11.1 Breakpoints

| Viewport | Behavior |
|---|---|
| ≥1200px | Full canvas. Both rails available. |
| 900–1199px | Full canvas. Both rails default to collapsed (icon-only); user can expand. Opening one auto-collapses the other to preserve canvas area. |
| <900px | **Read-only mode.** See §11.2. |

### 11.2 <900px read-only

The canvas renders but:

- Pan and zoom work (read).
- All editing controls are hidden: rails collapsed and non-expandable, top-bar kebab hidden, context menu disabled, resize handles hidden, selection ring on tap only (tap shows the ring + a floating "View on desktop" hint for 2s).
- A sticky banner appears at the top of the viewport, 36px tall, `--ivory-paper` fill, `1px solid var(--stone-200)` bottom:
  > *Study Bench boards read best on desktop. Open on a larger screen to arrange your board.*
  - `12px font-body`, color `var(--reader-ink)` at 0.85, left-aligned with 16px padding.
  - Right side of the banner: a `x` dismiss (session-scoped).
- Reader's Clip-to-Bench actions still work on mobile; clips go to the Recent Clips tray (invisible on mobile, visible next time the user opens the Bench on desktop).

### 11.3 Orientation

Landscape below 900px: same read-only treatment. No "tablet-portrait special case" — the decision criterion is horizontal space for cards + rails, and no tablet viewport supplies enough.

---

## 12. Performance budgets

Targets measured on a 2021 MacBook Air M1 with the app running in production mode against a local dev dataset.

| Metric | Budget | Verification |
|---|---|---|
| First meaningful paint of a 25-clipping board after `prewarmBoard` returns | <1000ms | Lighthouse mobile-disabled; trace LCP |
| Interaction-to-next-paint during drag (single card) | <50ms p95 | Performance panel; synthetic drag 120 moves over 2s |
| Interaction-to-next-paint during multi-drag (10 cards) | <80ms p95 | same, 10-card selection |
| Canvas interactive at 100 clippings + 50 connections | sustained 60fps during pan | dev-tools FPS meter |
| Memory ceiling for a 100-clipping board | <180MB heap | DevTools memory snapshot |
| Initial JS bundle for `/bench/[boardId]` route | ≤220KB gzipped | Next.js build output |

### 12.1 Techniques (guidance for 32b)

- The transform plane uses `transform: translate3d(x, y, 0) scale(z)` with `will-change: transform`, set only while actively panning/zooming (removed on idle).
- Cards render as pure React components with `React.memo` keyed on `{x, y, width, height, color, updatedAt}`. Dragging one card does not re-render siblings.
- Connection paths recompute only when an endpoint card's position changes (subscription model; each connection listens to exactly its two endpoints).
- Dot grid renders as a single CSS background on the transform plane — zero per-dot DOM nodes.
- Grain + tonal wash are `position: fixed` layers on the `ReaderSurface` — they do not transform with the camera.
- SVG connection layer updates via a single `<path d="...">` per connection; `d` string is recomputed only on endpoint moves.
- Text rendering inside cards uses the reader's existing markdown/verse renderers — no re-implementation.

### 12.2 Failure mode

If profiling during 32b shows the SVG connection layer exceeding frame budget beyond 150 connections, escalate to a Canvas 2D fallback for the connection layer (cards remain SVG/DOM). This is a documented escape hatch; budget evaluation happens during 32b's milestone-close verification.

---

## 13. Open questions — resolved

| # | Question | Resolution | Rationale |
|---|---|---|---|
| 1 | Pan/zoom library vs. native | **Native CSS transforms in a small custom hook.** | Library would force us to override its transitions to match reader motion; a ~150-line `useCanvasCamera` gives precise control over inertia, keyboard pan, zoom-at-cursor, and prefers-reduced-motion. No new dependency. |
| 2 | SVG vs Canvas for connections | **SVG.** | A11y + focusability + interactive label pills are all cheap in SVG. Canvas fallback documented in §12.2 as an escape hatch only if perf benchmarks fail at >150 arrows. |
| 3 | Snap-to-grid default | **Off. Hold `Shift` during drag to snap to 8px grid.** | Free placement preserves the library-table feel. Shift-held matches Brief 30 §3.2 exactly. No kebab toggle — the gesture is the toggle. |

---

## 14. Acceptance narrative (Loom-able, 5-minute flow)

A first-time user, signed in, studying a question on forgiveness.

**0:00 — Enters `/bench`.** The URL loads. Top-bar chrome fades in over 240ms (`chrome-mount`). The dashboard area is mostly empty paper. In the top-right a 340px first-run panel slides in over 220ms (`panel-slide`): *"The Study Bench — Every board is one question. Drag sources from the rail. Draw arrows to show how they fit. [ Got it ]."* Behind it, centered on the paper: *"A blank library table. Every board is one question — you bring it, the Bench helps you arrange the sources around it."* Below, a sage primary button: `+ New board`.

**0:10 — Clicks `+ New board`.** A lightweight picker modal appears (owned by 34a, referenced here for narrative completeness): four options — Word Study, Character Study, Passage Study, Blank. The user picks Blank. Modal dismisses. Router pushes to `/bench/[newBoardId]`.

**0:14 — New board surface renders.** Top bar mounts. Title reads *Untitled board* in `var(--stone-300)` placeholder; question field reads *What are you studying?* Center-canvas, a soft guide fades in after 160ms (`card-enter` re-used): *"Start here. Drag a verse, entity, or note from the left rail — or clip something while reading a study."* A subtle chevron-left pulses toward the collapsed source drawer.

**0:22 — User types into the question field.** *"How do the NT writers handle Exodus 34 on God's compassion?"* Enter commits. The centered guide text gently persists because the canvas is still empty.

**0:32 — User clicks the source-drawer icon on the left rail.** The rail panel-slides in over 220ms. The search input auto-focuses. They type *"Ex 34"* and hit Enter. The Verses tab populates with `Exodus 34:6` through `Exodus 34:9`, each a draggable mini-card with a translation chip.

**0:48 — Drags Exodus 34:6 onto the center-left of the canvas.** The mini-card follows the pointer; on drop, it turns into a real Verse clipping (300×140). Card-enter motion: 200ms fade + 8px slide from drop point. The centered guide text fades out over 160ms (it only stays for the first clipping).

**1:15 — Drags the Entities tab → searches *"compassion"* → drops an entity snippet for *"YHWH, attributes of"* at center-right.**

**1:40 — Drags Hebrews 8:12 from the Verses tab onto the lower-center.** Third clipping placed.

**2:00 — Hovers the bottom edge of the Exodus 34:6 card.** The edge hairline lights up; cursor becomes `crosshair`. User presses-and-holds. After 300ms the ghost connection appears — `1.5px dashed var(--sage-500)` at opacity 0.6, tracking the pointer.

**2:06 — User drags the ghost toward the Hebrews 8:12 card.** As the pointer enters the Hebrews card's edge zone, the edge hairline lights and the ghost snaps to the nearest edge anchor.

**2:09 — User releases.** Ghost solidifies over 160ms (`connection-draw-solidify`) — the dash collapses and the stroke fills in, arrowhead appears. A label popover opens inline at the midpoint, autofocused with placeholder `Label (optional)`. User types `echoes` and hits Enter. The pill renders at the midpoint over 160ms (`connection-label-reveal`).

**2:30 — User hovers the arrow.** The Exodus + Hebrews cards stay at full opacity; the entity card fades to 0.4 (`card-focus-fade`). User mouses off the arrow; entity card fades back in over 200ms.

**2:45 — User zooms in.** `Cmd +=` twice. Camera zooms at viewport center in two 180ms steps. Cards scale up smoothly; the paper grain stays fixed; the dot grid fades in cleanly as zoom crosses 1.0.

**3:00 — User closes the tab.** Before close, the debounce (300ms) commits the final camera position to `/api/bench/boards/:id/camera`. Clippings + connections are already persisted from their individual 250ms debounces.

**Next day — User returns to `/bench`.** Dashboard shows a single board card: title auto-derived *"How do the NT writers handle Exodus 34…"*, question text below, 3-clipping count, "1d ago" timestamp, thumbnail showing the three cards + connection.

**User clicks the card.** Router pushes to `/bench/[boardId]`. Server renders, `prewarmBoard` resolves within 1s, page hydrates. Camera restores to yesterday's `{x, y, zoom}`. Three cards are exactly where they were left. The *"echoes"* connection is drawn. First-run panel does not appear (flag set). Everything is where it was.

---

## 15. Locked decisions — index

One table, scannable. Each row points back to the section that elaborates.

| # | Decision | Value | Source |
|---|---|---|---|
| 1 | Canvas background | Reader paper surface (grain + tonal wash), TOD-bucket on load | §1.1 |
| 2 | Dot grid | 32px dots, `var(--stone-300)` @ 0.10, fade 1.0→0.6, hide below 0.6 | §1.2 |
| 3 | Zoom range | 0.25× – 2× | §1.3 |
| 4 | Pan/zoom implementation | Native CSS transform via custom `useCanvasCamera` hook | §13 |
| 5 | Camera inertia | 120ms linear-decay, only above 800 px/s release velocity | §1.4 |
| 6 | Card corner radius | 10px | §2.1 |
| 7 | Card background | New `--ivory-paper` token at 0.94 opacity | §2.1 |
| 8 | Card default sizes | Per-type (verse 300×140 … study 500×380) | §2.4 |
| 9 | Color swatches | Default / Sage / Warmth / Stone (3px left stripe + border) | §2.5 |
| 10 | Connection render | SVG overlay, cubic Bézier with 33% longitudinal + 8% lateral sag | §3 / §13 |
| 11 | Connection stroke | 1.5px default, 2px hover/selected, `var(--sage-500)` (700 selected) | §3.3 |
| 12 | Label pill | 11px font-sans on `--ivory-paper`, sage-300 border, max 60 chars | §3.5 |
| 13 | Drag-to-connect | 300ms press-hold on edge zone | §3.6 |
| 14 | Undo depth | 20 frames, in-memory only | §4.5 |
| 15 | Snap-to-grid | Off by default; Shift-held snaps to 8px | §13 |
| 16 | Multi-select | Lasso + Shift+click; Cmd/Ctrl+A scoped to viewport | §4.4 |
| 17 | Top bar | 56px, sticky, breadcrumb + title + question + meter + kebab | §5 |
| 18 | Source drawer | 320px expanded, 48px collapsed, 6 tabs, `Cmd/Ctrl+K` focus | §6 |
| 19 | Recent Clips tray | 280px expanded, 48px collapsed, newest-first, 30-day dismiss recovery | §7 |
| 20 | Empty states | Four final copy blocks (§8.1–§8.4) + first-run panel (§8.5) | §8 |
| 21 | Motion vocabulary | Reuse reader `READER_MOTION_*` where possible; new entries enumerated | §9 |
| 22 | Keyboard canvas | Tab by creation order; arrow-nudge 8px/32px; Enter expands | §4.4 / §10 |
| 23 | ARIA labels | `{type} clipping · {label} · position row R col C` | §10.2 |
| 24 | Reduced motion | All transforms stripped; opacity retained capped at 1 frame; no inertia | §10.5 |
| 25 | Responsive | ≥1200 full, 900–1199 rails collapsed, <900 read-only with banner | §11 |
| 26 | Perf budget | <1s FMP @ 25 clippings; <50ms INP single-drag; 60fps pan @ 100 clippings | §12 |
| 27 | Canvas fallback | SVG-only at v1; Canvas 2D for connections gated behind §12 budget failure | §12.2 / §13 |

---

## 16. Handoff

Brief 32b (Sonnet) reads §1–15 and implements. Every visual + motion value is either reused from `app/lib/motion/reader.ts` / `app/app/globals.css` / `ReaderSurface` or introduced here with an explicit token name and value.

New tokens this brief introduces (to be added to `app/app/globals.css` in Brief 32b):

```css
--ivory-paper: #fdfaf3;          /* light; card fill base */
--ivory-paper-dark: #3a362f;     /* dark mode card fill base */
--sage-400: #90a086;             /* lasso + intermediate affordances */
```

New motion constants this brief introduces (to be added to `app/lib/motion/reader.ts` or a new `app/lib/motion/bench.ts`):

```
BENCH_MOTION_CARD_ENTER              — 200ms, cubic-bezier(.2,.8,.2,1)
BENCH_MOTION_CARD_DRAG_LIFT          — 120ms, ease-out
BENCH_MOTION_CARD_EXPAND             — 200ms, ease-in-out
BENCH_MOTION_CARD_DELETE             — 160ms, cubic-bezier(0.4, 0, 1, 1)
BENCH_MOTION_FOCUS_FADE              — 160ms, ease-out
BENCH_MOTION_FOCUS_UNFADE            — 200ms, ease-out
BENCH_MOTION_CONNECTION_SOLIDIFY     — 160ms, cubic-bezier(.2,.8,.2,1)
BENCH_MOTION_CONNECTION_GHOST_FADE   — 120ms, ease-out
BENCH_MOTION_PANEL_SLIDE             — 220ms, ease-out
BENCH_MOTION_PANEL_SLIDE_EXIT        — 180ms, cubic-bezier(0.4, 0, 1, 1)
BENCH_MOTION_SELECTION_RING          — 140ms, ease-out
BENCH_MOTION_CAP_MODAL_SHAKE         — 320ms, cubic-bezier(.36,.07,.19,.97)
BENCH_MOTION_FIT_TO_BOARD            — 300ms, cubic-bezier(.2,.8,.2,1)
BENCH_MOTION_ZOOM_STEP               — 180ms, ease-out
BENCH_MOTION_CAMERA_INERTIA          — 120ms, linear-decay
```

Everything else (context-menu, toast, chrome mount) reuses existing `READER_MOTION_*` exports directly.
