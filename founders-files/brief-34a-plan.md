# Brief 34a — Study Bench: Starter Templates + License-Meter (Design)

> **Branch:** `phase-5c/34a-templates-design` off `develop`.
> **Phase:** 5c — Wave 4 opener. Depends on 30 (direction), 32a (canvas visual language). Gates 34b (templates implementation + license-meter wiring). Parallel-safe with 33.
> **Deliverable type:** design document only. 34a changes no code. 34b copies the concrete descriptors and specs in §§1–10 into `app/lib/bench/templates.ts`, the picker dialog, and the meter components.

---

## 0. Preamble

Brief 30 committed to **Blank + three deterministic templates**: Word Study, Character Study, Passage Study. The three templates are the most-seen piece of the Bench — a new user picks one within 30 seconds of their first visit, and the layout decides whether the surface reads as *editorial* ("this respects my time") or *tutorial-y* ("this is going to teach me how to study"). Koinar's answer is editorial.

This plan is paired with the **license-meter chip + cap-hit modal** visual spec because both surfaces first become visible on the same screen — a template-seeded board with translation-compare placeholders. The two visual languages must harmonize on first sight.

**Scope boundary:** design-only. No tokens, components, or types change in 34a. Every value in this document is pinned for 34b to implement mechanically.

**Canonical references:**
- Visual grammar: `founders-files/brief-32a-plan.md` — every template layout sits inside its grammar (ivory-paper fill, stone-200 border, sage-500 arrows, 10px radius, tabular cross-ref weights).
- Type union: `BenchClipping.clipping_type` at `app/lib/db/types.ts:421–441`.
- Motion precedent: `app/components/reader/entity-drawer.tsx` + `app/lib/motion/reader.ts`.
- Voice: `founders-files/UI-GUIDELINES.md` and the Ritz-Carlton / Four Seasons restraint in `design-references/`.

**Coordinate convention (applies to §§1–3).** All `(x, y)` values in the layout tables and descriptors are the clipping's **top-left** corner, matching the `x`/`y` columns on `bench_clippings` and 34b's `position: absolute` render. The origin `(0, 0)` is the visual center of the template canvas region — cards "at center" therefore have negative top-left coordinates equal to `(−width/2, −height/2)`. 34b instantiates the template by translating all template coordinates into board-local coordinates (the board's initial camera centers on `(0, 0)`).

---

## 1. Template: Word Study

**Intent.** The user has a word or concept ("ἀγάπη / love", "shalom", "justice") and wants to understand its shape across scripture.

**Layout (960 × 600 canvas region, centered at origin).**

| Placeholder | Type | x, y (TL) | w, h |
|---|---|---:|---:|
| Lexicon entry (center) | `lexicon` | −140, −90 | 280 × 180 |
| Occurrence 1 (upper-left) | `verse` | −340, −220 | 280 × 120 |
| Occurrence 2 (upper-right) | `verse` | 60, −220 | 280 × 120 |
| Occurrence 3 (lower-left) | `verse` | −340, 60 | 280 × 120 |
| Translation-compare (far-right) | `translation-compare` | 420, −80 | 560 × 240 |
| User note (bottom) | `note` | −140, 260 | 560 × 160 |

**Placeholder bodies (final copy, do not revise):**
- Lexicon: *Drop a Strong's entry here.*
- Verse #1–3: label only ("Occurrence 1", "Occurrence 2", "Occurrence 3"); no body.
- Translation-compare: *Drop one of the verses here to see it in 2–4 translations side by side.*
- User note: *What are you noticing about this word's range?*

**Arrows (pre-drawn, unlabeled — user labels after filling in).** Sage-500 at 1.5px, 33% x-offset, 8% sag (per 32a §2.7).
- `lexicon-center → verse-1`
- `lexicon-center → verse-2`
- `lexicon-center → verse-3`

**Template card in picker (§4).**
- Thumbnail: miniature of the layout at 25% opacity with the lexicon card highlighted to 60%. 240 × 160 frame, ivory-paper fill, stone-200 border.
- Title: **Word Study**
- Subtitle: **Follow a word across scripture.**
- Description (12px italic, stone-500): *For questions like "what does shalom mean?" or "where does ἀγάπη appear?"*

**Descriptor** (concrete TS literal for 34b to copy):

```ts
{
  id: 'word-study',
  title: 'Word Study',
  subtitle: 'Follow a word across scripture.',
  description: 'For questions like "what does shalom mean?" or "where does ἀγάπη appear?"',
  clippings: [
    { placeholder_id: 'lexicon-center', clipping_type: 'lexicon',             x: -140, y:  -90, width: 280, height: 180, placeholder_body: "Drop a Strong's entry here." },
    { placeholder_id: 'verse-1',        clipping_type: 'verse',               x: -340, y: -220, width: 280, height: 120 },
    { placeholder_id: 'verse-2',        clipping_type: 'verse',               x:   60, y: -220, width: 280, height: 120 },
    { placeholder_id: 'verse-3',        clipping_type: 'verse',               x: -340, y:   60, width: 280, height: 120 },
    { placeholder_id: 'tc-right',       clipping_type: 'translation-compare', x:  420, y:  -80, width: 560, height: 240, placeholder_body: 'Drop one of the verses here to see it in 2–4 translations side by side.' },
    { placeholder_id: 'note-bottom',    clipping_type: 'note',                x: -140, y:  260, width: 560, height: 160, placeholder_body: "What are you noticing about this word's range?" },
  ],
  connections: [
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-1' },
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-2' },
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-3' },
  ],
}
```

---

## 2. Template: Character Study

**Intent.** The user is studying a person (Ruth, Paul, Caleb) and wants to gather verses, relationships, and their own synthesis.

**Layout.**

| Placeholder | Type | x, y (TL) | w, h |
|---|---|---:|---:|
| Entity (center) | `entity` | −160, −90 | 320 × 180 |
| Six verse placeholders (radial, 340px from center) | `verse` | see table below | 280 × 120 each |
| Relationships (far-left strip) | `note` | −780, −240 | 280 × 240 |
| Synthesis note (bottom) | `note` | −140, 280 | 560 × 160 |

**Six verse positions pinned (280 × 120 each; angle is the card's visual-center angle from origin at radius 340; `x, y` is the TL corner):**

| Placeholder_id | angle | center x | center y | TL x | TL y |
|---|---:|---:|---:|---:|---:|
| `verse-r`   | 0°   | +340 |    0 | +200 |  −60 |
| `verse-ur`  | 60°  | +170 | −294 |  +30 | −354 |
| `verse-ul`  | 120° | −170 | −294 | −310 | −354 |
| `verse-l`   | 180° | −340 |    0 | −480 |  −60 |
| `verse-ll`  | 240° | −170 | +294 | −310 | +234 |
| `verse-lr`  | 300° | +170 | +294 |  +30 | +234 |

Relationships TL shifted from `(−720, −240)` to `(−780, −240)` to clear `verse-l` with a 20px gap.

**Placeholder bodies:**
- Center entity: *Drop the person here.*
- Six verses: label "Verse" only; no body.
- Relationships: *Who is this person connected to, and how? (Mentor, rival, spouse, adversary…)*
- Synthesis note: *What is the shape of this person's life from the verses above?*

**Entity tier.** The center entity renders at `summary` tier by default — this is a render-time concern of the `entity` clipping component, **not** a descriptor field. No schema change and no user-facing signal in the placeholder copy; the tier is established on first render of a real entity.

**Arrows (sage-500, 1.5px):**
- `entity-center → verse-r | verse-ur | verse-ul | verse-l | verse-ll | verse-lr` (six)
- `entity-center ↔ note-relationships` (bidirectional)

**Template card in picker.**
- Title: **Character Study**
- Subtitle: **A person, their verses, the people in their orbit.**
- Description: *For questions like "what kind of leader was Caleb?" or "who is Ruth becoming?"*

**Descriptor:**

```ts
{
  id: 'character-study',
  title: 'Character Study',
  subtitle: 'A person, their verses, the people in their orbit.',
  description: 'For questions like "what kind of leader was Caleb?" or "who is Ruth becoming?"',
  clippings: [
    { placeholder_id: 'entity-center',      clipping_type: 'entity', x: -160, y:  -90, width: 320, height: 180, placeholder_body: 'Drop the person here.' },
    { placeholder_id: 'verse-r',            clipping_type: 'verse',  x:  200, y:  -60, width: 280, height: 120 },
    { placeholder_id: 'verse-ur',           clipping_type: 'verse',  x:   30, y: -354, width: 280, height: 120 },
    { placeholder_id: 'verse-ul',           clipping_type: 'verse',  x: -310, y: -354, width: 280, height: 120 },
    { placeholder_id: 'verse-l',            clipping_type: 'verse',  x: -480, y:  -60, width: 280, height: 120 },
    { placeholder_id: 'verse-ll',           clipping_type: 'verse',  x: -310, y:  234, width: 280, height: 120 },
    { placeholder_id: 'verse-lr',           clipping_type: 'verse',  x:   30, y:  234, width: 280, height: 120 },
    { placeholder_id: 'note-relationships', clipping_type: 'note',   x: -780, y: -240, width: 280, height: 240, placeholder_body: 'Who is this person connected to, and how? (Mentor, rival, spouse, adversary…)' },
    { placeholder_id: 'note-synthesis',     clipping_type: 'note',   x: -140, y:  280, width: 560, height: 160, placeholder_body: "What is the shape of this person's life from the verses above?" },
  ],
  connections: [
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-r' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ur' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ul' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-l' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ll' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-lr' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'note-relationships', bidirectional: true },
  ],
}
```

---

## 3. Template: Passage Study

**Intent.** The user is reading a passage (Romans 12, Psalm 23) and wants to slow down with translations, cross-references, and their own notes.

**Layout.**

| Placeholder | Type | x, y (TL) | w, h |
|---|---|---:|---:|
| Verse-range (top strip) | `verse` | −280, −260 | 560 × 120 |
| Translation-compare (below top) | `translation-compare` | −280, −110 | 560 × 240 |
| Cross-ref chain (right column) | `cross-ref-chain` | 340, −260 | 320 × 400 |
| What to know first (lower-left) | `note` | −580, 160 | 280 × 240 |
| What is this passage claiming? (lower-center) | `note` | −280, 160 | 560 × 240 |
| Where does this lead me? (lower-right) | `note` | 340, 160 | 320 × 240 |

**Placeholder bodies:**
- Verse-range: *The passage.*
- Translation-compare: seeded with `['bsb', 'niv']`; no body copy.
- Cross-ref chain: *Drop the passage here to see the cross-references that fan out.*
- Lower-left note: *What do you need to know before reading?*
- Lower-center note: *What is this passage claiming?*
- Lower-right note: *Where does this lead me?*

**Arrows:**
- `verse-top → translation-compare`, label "translations" in stone-400 (faint, pre-filled).
- `verse-top → cross-ref-chain`, label "cross-refs".
- `verse-top → note-context`, `verse-top → note-claims`, `verse-top → note-leads` (unlabeled).

**Template card in picker.**
- Title: **Passage Study**
- Subtitle: **One passage, held slowly.**
- Description: *For questions like "what is Romans 12 asking of me?" or "how does Psalm 23 hold together?"*

**Descriptor:**

```ts
{
  id: 'passage-study',
  title: 'Passage Study',
  subtitle: 'One passage, held slowly.',
  description: 'For questions like "what is Romans 12 asking of me?" or "how does Psalm 23 hold together?"',
  clippings: [
    { placeholder_id: 'verse-top',           clipping_type: 'verse',               x: -280, y: -260, width: 560, height: 120, placeholder_body: 'The passage.' },
    { placeholder_id: 'translation-compare', clipping_type: 'translation-compare', x: -280, y: -110, width: 560, height: 240, seed_source_ref: { translations: ['bsb', 'niv'] } },
    { placeholder_id: 'cross-ref-chain',     clipping_type: 'cross-ref-chain',     x:  340, y: -260, width: 320, height: 400, placeholder_body: 'Drop the passage here to see the cross-references that fan out.' },
    { placeholder_id: 'note-context',        clipping_type: 'note',                x: -580, y:  160, width: 280, height: 240, placeholder_body: 'What do you need to know before reading?' },
    { placeholder_id: 'note-claims',         clipping_type: 'note',                x: -280, y:  160, width: 560, height: 240, placeholder_body: 'What is this passage claiming?' },
    { placeholder_id: 'note-leads',          clipping_type: 'note',                x:  340, y:  160, width: 320, height: 240, placeholder_body: 'Where does this lead me?' },
  ],
  connections: [
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'translation-compare', label: 'translations' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'cross-ref-chain',     label: 'cross-refs' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-context' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-claims' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-leads' },
  ],
}
```

**Blank descriptor** (for completeness):

```ts
{
  id: 'blank',
  title: 'Blank',
  subtitle: 'A quiet surface. You bring everything.',
  description: 'For when the question is still forming, or when you already know the shape.',
  clippings: [],
  connections: [],
}
```

---

## 4. Template picker surface

On `/bench` dashboard → "New board" button → a shadcn `Dialog` opens, titled **"Start from…"**.

**Layout.** 2 × 2 grid of `Card` entries, in order:

```
┌─────────────┬─────────────┐
│   Blank     │ Word Study  │
├─────────────┼─────────────┤
│  Character  │   Passage   │
│   Study     │   Study     │
└─────────────┴─────────────┘
```

**Card anatomy (each entry).**
- Frame: 240 × 200, ivory-paper fill, 1px stone-200 border, 10px radius.
- Hover: border becomes sage-500, shadow-sm lifts, 120ms ease-out.
- Padding: 16px.
- Thumbnail: 160 × 96 centered at top. Renders the layout miniature at 25% opacity with the hero element (lexicon / entity / verse-top / empty grain) highlighted at 60%.
- Title: 15px semibold, stone-900, 12px below thumbnail.
- Subtitle: 13px regular, stone-700, 4px below title.
- Description: 12px italic, stone-500, 8px below subtitle.

**Blank card copy.**
- Title: **Blank**
- Subtitle: *A quiet surface. You bring everything.*
- Description: *For when the question is still forming, or when you already know the shape.*

**Keyboard.** Tab cycles; Enter selects; Esc closes. Focus ring follows 32a §3.2 (sage-500, 2px, 2px offset).

**Motion.** Dialog enters with backdrop fade (120ms) + content fade-and-rise 8px (200ms, `cubic-bezier(.2,.8,.2,1)`). Grid items fade-in 180ms with 40ms stagger. `prefers-reduced-motion`: fade only, no rise, no stagger.

**Entry point.** Replace `app/components/bench/board-dashboard.tsx:24–41`'s inline input with a button labeled **"New board"** that opens this Dialog. On select, the flow POSTs `/api/bench/boards` with `{ title, template_id }` (title defaults to the template name + timestamp, renameable in-canvas later), then `router.push('/bench/[newBoardId]')`.

---

## 5. Copy voice

Every placeholder body and every template subtitle in §§1–3 is **final copy**. It is not a placeholder for the implementer to revise. Voice test: terse, warm, non-didactic, never cute. If a line feels like a tutorial, it fails. If it feels like a librarian's shelf-label, it passes.

---

## 6. TemplateDescriptor shape (finalized)

```ts
// app/lib/bench/templates.ts (new file, owned by 34b)

import type { BenchClipping, BenchClippingSourceRef } from '@/lib/db/types'

export type TemplateId = 'blank' | 'word-study' | 'character-study' | 'passage-study'

export type TemplateClipping = {
  placeholder_id: string                    // stable within template
  clipping_type: BenchClipping['clipping_type']
  x: number
  y: number
  width: number
  height: number
  placeholder_body?: string                 // rendered in empty state
  seed_source_ref?: Partial<BenchClippingSourceRef>  // e.g. { translations: ['bsb','niv'] }
}

export type TemplateConnection = {
  from_placeholder_id: string
  to_placeholder_id: string
  label?: string
  bidirectional?: boolean
}

export type TemplateDescriptor = {
  id: TemplateId
  title: string
  subtitle: string
  description: string
  clippings: TemplateClipping[]
  connections: TemplateConnection[]
}

export const TEMPLATES: Record<TemplateId, TemplateDescriptor> = {
  blank:            /* see §3 */,
  'word-study':     /* see §1 */,
  'character-study':/* see §2 */,
  'passage-study':  /* see §3 */,
}
```

34b copies the four objects above into this file verbatim. No design judgment remains.

---

## 7. License-meter chip — visual spec

**Placement.** Top bar, right cluster, left of the kebab menu (32a §5.3 reserves 280px for this cluster; 4 chips at ~56px average + 3 × 8px gap = 256px, leaves 24px to the kebab).

**Order.** NIV, NLT, NASB, ESV, left → right. Chips for translations **not present on the current board** are not rendered.

**Chip anatomy.**
- Height 28px. Horizontal padding 10px. Corner radius 8px.
- Leading status dot, 6px, 8px gap to label.
- Label: `<TRANS> <n> / <cap>`. Example: `NIV 18 / 25`.
- Typography: 12px, `tabular-nums`. Numerator semibold, denominator regular, "/" regular, translation abbreviation semibold.

**States.**

| State | % of cap | Background | Text | Dot |
|---|---|---|---|---|
| Comfortable | 0–79 | `stone-100` | `stone-700` | `sage-500` |
| Approaching | 80–99 | `amber-50` | `amber-700` | `amber-500` |
| At cap | 100 | `red-50` | `red-700` | `red-500` |

**New tokens required** (added to `app/app/globals.css` by 34b, not 34a):

```css
--amber-50:  #fffbeb;
--amber-500: #f59e0b;
--amber-700: #b45309;
--red-50:    #fef2f2;
--red-500:   #ef4444;
--red-700:   #b91c1c;
```

**New utility** (added to globals.css alongside tokens):

```css
.tabular-nums { font-variant-numeric: tabular-nums; }
```

**Hover.** Tooltip (Popover, 160ms enter / 120ms exit per `app/lib/motion/reader.ts`) shows the sentence in §9.

**Click.** Opens a new tab to `/attributions#<translation>` (e.g. `/attributions#niv`).

---

## 8. License-meter cap-hit modal

**Trigger.** A drop or translation-change that would push the current board over the cap for that translation.

**Copy (NIV template).**
- Title: **You've reached the NIV display limit on this board.**
- Body: **The NIV is licensed to display up to 25 verses per board. You can remove an existing NIV clipping from this board, change its translation, or start a new board for the next set of verses.**
- Primary action: **Change translation** (opens an inline translation picker for the attempted drop).
- Secondary action: **Start a new board**.
- Tertiary action: **Cancel**.
- Footer link (below actions, 12px stone-500 underline): **Learn why** → `/attributions#niv`.

**Per-translation variants** (identical sentence shape, only the name and number change):

- **NLT (cap 500):**
  - Title: **You've reached the NLT display limit on this board.**
  - Body: **The NLT is licensed to display up to 500 verses per board. You can remove an existing NLT clipping from this board, change its translation, or start a new board for the next set of verses.**
- **NASB (cap 1000):**
  - Title: **You've reached the NASB display limit on this board.**
  - Body: **The NASB is licensed to display up to 1000 verses per board. You can remove an existing NASB clipping from this board, change its translation, or start a new board for the next set of verses.**
- **ESV (cap 500):**
  - Title: **You've reached the ESV display limit on this board.**
  - Body: **The ESV is licensed to display up to 500 verses per board. You can remove an existing ESV clipping from this board, change its translation, or start a new board for the next set of verses.**

**Motion.** Modal enters: backdrop fade 200ms + content fade-and-rise 8px 200ms, `cubic-bezier(.2, .8, .2, 1)` (matches `app/components/reader/entity-drawer.tsx`). Escape closes. `prefers-reduced-motion`: fade only, no rise.

---

## 9. Tooltip copy (hover on meter chip)

The same three sentence shapes apply across NIV, NLT, NASB, ESV — swap the translation name and the cap number.

- **Comfortable** (`NIV 18 / 25`): *This board is using 18 of your 25 NIV verses. Each board is its own display view.*
- **Approaching** (`NIV 22 / 25`): *You're close to the NIV display limit on this board. Start a new board for your next set of NIV verses.*
- **At-cap** (`NIV 25 / 25`): *You're at the NIV display limit on this board. Remove a clipping or change its translation to add more NIV.*

---

## 10. A11y

- Each meter chip exposes `aria-label` with the full sentence: *"NIV 18 of 25 verses used on this board."* The aria-label always uses "of" (not "/"), and always includes "verses used on this board" — screen-reader users get the same context sighted users get from the chip shape + tooltip.
- The cap-hit modal is `role="alertdialog"` with focus trapped inside; the Cancel button and Escape key both close it and return focus to the trigger.
- Color is never the only carrier of meaning: the dot color, the numerator/denominator text, and the aria-label all repeat the status independently.
- `prefers-reduced-motion`: chips do not animate state changes; the modal enters with fade only (no rise); tooltip transitions shorten to 80ms fade.
- Keyboard: Tab through chips is reachable from the top-bar focus order; Enter on a chip activates the `/attributions#<trans>` link (same as click). Tooltip opens on focus as well as hover.

---

## 11. Verification

Four gates before 34b is considered done:

1. Each of the three template subtitles reads at Koinar's voice when David reads them out loud. If any line lands as tutorial or cute, it is rewritten *in this plan*, not in code.
2. One non-technical reader (not an engineer on the project) can pick the right template for a question they bring, without reading a help page. Test this with a single reader before 34b ships.
3. The meter chip visual passes at 100% zoom and at 200% zoom: no truncation, no layout shift, no overlap with the kebab menu at the 4-chip worst case (NIV + NLT + NASB + ESV all present).
4. The cap-hit modal copy reads out loud without discomfort. No word lands as corporate ("display rights"), legal ("license terms"), or scolding ("you cannot").

---

## Acceptance

- Plan file reviewed by David.
- All four TemplateDescriptor objects concretely specified (no placeholders, no "TBD").
- Meter chip + modal visual and copy spec complete — all four translation variants present, all three states specified, all tokens pinned.
- Voice audit passed on David's read-through.

---

## Open notes (documented, not revisited)

- Template-specific card dimensions deviate slightly from 32a's defaults. All values are above 32a's min-dims. This is intentional: template layouts compose a whole board; 32a defaults apply to user-created clippings on blank boards.
- Entity `tier` is a render-time concern of the `entity` clipping component, not a descriptor field. No schema change.
- Amber/red token scales and the `tabular-nums` utility are added to `app/app/globals.css` in 34b alongside the chip implementation; the values are pinned in §7 of this plan so 34b doesn't pick them.
