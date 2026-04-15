# Implementation Plan — Koinar Bible Study Community App

## Context

All 16 implementation briefs (01-15 + 06a) are written and the UI/UX design spec (Sage & Stone) is finalized. **Phase 0 is complete as of April 11, 2026** — the app is scaffolded, the coming-soon teaser is live at koinar.app, and the staging environment is ready for Phase 1.

**App name confirmed:** **Koinar** (koinar.com)
- Rooted in *koinonia* (κοινωνία, Greek: deep fellowship of the early church) and *edah* (עֵדָה, Hebrew: God's gathered assembly). Koin- carries the fellowship; -ar echoes the gathering. One name, two testaments, one community.
- The name is the front door — simple, bold, easy to remember. The koinonia + edah etymology is the depth you discover on the About page.

**Domains purchased:** koinar.app (primary) + koinar.com (301 redirect to koinar.app). `NEXT_PUBLIC_APP_URL=https://koinar.app` in production. Development uses `localhost`.

**Repository:** `git@github.com:th3fifthestate/koinar-study.git`
**App directory:** `/Users/davidgeorge/Desktop/study-app/app/` (Next.js project root)
**Working directory:** `/Users/davidgeorge/Desktop/study-app/` (contains `app/`, `briefs/`, `founders-files/`, `docs/`)

**Deployment strategy:** Same repo, branch-based.
- `main` branch → atmospheric coming soon teaser → deployed to koinar.app + koinar.com (Railway production)
- `develop` branch → full app build (Briefs 01-15) → deployed to staging.koinar.app (Railway staging, behind Cloudflare Access)
- At launch: merge `develop` → `main`, production swaps from teaser to full app
- Coming soon email capture stored in **Resend audience** → imported into app DB at launch

---

## Key Decisions (Confirmed April 8, 2026)

### AI Study Generation
- **Model:** Claude Opus 4.6 (`claude-opus-4-6`) — $5/$25 per million tokens (input/output). Model ID stored as env var `AI_MODEL_ID` for future upgrades. Same price as Opus 4.5 but with 1M context window, 128K max output, and adaptive thinking.
- **Estimated costs per study type:**
  - Simple (500-1,500 words, 8-12 tool calls): **~$0.15/study**
  - Standard (1,500-3,000 words, 15-25 tool calls): **~$0.28/study**
  - Comprehensive (3,000-5,000 words, 25-40+ tool calls): **~$0.50/study**
- **Study formats:** Simple, Standard, Comprehensive (replaces concise/comprehensive/narrative)
- **Access model:** Generation UI is **locked by default**. Only visible to:
  - **BYOK users** — users who add their own Anthropic API key (unlimited, their key pays)
  - **Gift code holders** — admin creates single-use or multi-use (N uses) codes tied to a specific user and study format. User enters code → generation UI unlocks for that format only → code burns on use. When all uses are spent, UI locks again.
  - **Admin** — always has access, generates on admin key
- **No free tier** — users without BYOK or active gift code can only read community studies
- **BYOK cost advisory** — UI shows estimated cost per format before generation (Simple ~$X, Standard ~$Y, Comprehensive ~$Z)
- **Gift code properties:** user-specific, format-locked, single-use or N-use count, expires when depleted

### 7-Step Protocol & Data Integrity
**The 7-Step Contextual Analysis Protocol remains the core methodology — unchanged and mandatory.** The data integrity rules below are **additions** to strengthen enforcement, not replacements:

1. **7-Step Protocol (PRESERVED):** Every verse must go through all 7 contextual checks (Immediate Context → Chapter Context → Book Context → Cross-References → Original Language → Historical/Narrative Context → Canonical Context). No verse cited without completing all steps.
2. **Data source rule:** All Bible content (verses, context, cross-references, Strong's definitions) MUST come from the 4 Bible databases via tool calls. NEVER from training data.
3. **Programmatic audit trail (NEW):** Every generated study includes a hidden `verification-audit` block listing each verse cited and the tool call ID that retrieved it. Post-generation parser cross-references audit block with actual tool executions. Flags any verse not backed by a tool call.
4. **Historical context (⛰️) — strengthened:** Allowed only for widely-accepted, cite-quality facts from high-quality, trusted sources (Josephus, Tacitus, Pliny, archaeological record). If uncertain, debated, or speculative, omit entirely.
5. **Theology rule:** No theological conclusions that cannot be backed by clear scriptural evidence. The Bible interprets the Bible. If the Bible does not clearly teach something, say so.
6. **Historical figures:** Users may request studies on historical figures as long as they have at least a moderate presence in the Bible (multiple mentions, named in narratives).
7. **Strengthened system prompt:** Includes explicit "NEVER from training data" repetition, stricter ⛰️ rules, theology constraints, and the verification checklist — all layered on top of the existing 7-step protocol.

**System prompt structure (7 sections):**
1. Role — researcher identity + 4 databases
2. 7-Step Contextual Analysis Protocol — the full protocol, unchanged
3. Strict Rules — strengthened with data integrity rules above
4. Context Verification Checklist — expanded with audit trail requirement
5. Study Templates — per format type (Simple/Standard/Comprehensive)
6. Output Format — markdown + JSON metadata + verification-audit block
7. Format-Specific Guidance — word counts and depth per format

### Translation Licensing Architecture (Researched April 8, 2026)

All studies are generated using BSB (public domain) only. Copyrighted translations are never touched by AI. Verse swaps are mechanical substitutions at the user's request.

#### Tier 1 — Public Domain (Launch)
No restrictions. Stored locally. Used for AI generation, in-app display, and all exports.

| Translation | Source | Verse Limit | Storage | In-App Display | PDF/DOCX Export |
|-------------|--------|-------------|---------|---------------|-----------------|
| **BSB** (Berean Standard Bible) | Local DB | Unlimited | Unlimited | ✅ | ✅ |
| **KJV** (King James Version) | Local DB | Unlimited | Unlimited | ✅ | ✅ |
| **WEB** (World English Bible) | Local DB | Unlimited | Unlimited | ✅ | ✅ |

#### Tier 2 — Licensed, Display + Export (Post-Launch)
Live API calls only. Per-translation caching and export rules vary.

| Translation | API Source | Verse Limit | Caching Strategy | In-App Display | PDF/DOCX Export | Key Restrictions |
|-------------|-----------|-------------|------------------|---------------|-----------------|------------------|
| **NASB** | api.bible | ≤1,000 verses per work | Cache ≤1,000 verses in SQLite, 14-day TTL | ✅ | ✅ (≤1,000 verses, ≤50% of work) | Most permissive. Explicit AI permission. Must link to lockman.org. Full copyright notice on web/app. |
| **ESV** | api.esv.org | ≤500 verses per query/work | **No persistent cache.** Live API call every time. | ✅ | ✅ (≤500 verses, ≤25% of work) | Must link to esv.org on every page. 23h download expiry. 5,000 queries/day, 1,000/hr, 60/min. No Creative Commons. |
| **NLT** | api.nlt.to | ≤500 verses per work | Cache with 14-day TTL (conservative) | ✅ | ✅ (≤500 verses, ≤25% of work) | Key-based: 500 verses/request, 5,000 requests/day. Returns HTML (must strip tags). Copyright notice required. |

#### Tier 3 — Licensed, Display Only (Post-Launch)
In-app reading only. No downloadable exports permitted.

| Translation | API Source | Verse Limit | Caching Strategy | In-App Display | PDF/DOCX Export | Key Restrictions |
|-------------|-----------|-------------|------------------|---------------|-----------------|------------------|
| **NIV** | api.bible | ≤500 verses per work | Cache for display only, 14-day TTL | ✅ | ❌ **Prohibited** | Biblica prohibits "uncontrolled downloads." Display and streaming only. No ads/monetization. Export option grayed out with explanation. |

#### Translation-Specific Implementation Rules

**ESV (Crossway) — api.esv.org:**
- Dedicated REST API with `Authorization: Token` header
- Endpoint: `GET /v3/passage/text/?q=John+3:16`
- Configurable: strip headings, footnotes, verse numbers for clean swap text
- **No caching** — every verse swap and every export triggers a live API call
- Every page displaying ESV text must include a link to www.esv.org
- Required copyright: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved."
- Users cannot download more than 500 verses of ESV text
- The ESV text may not be quoted under a Creative Commons license

**NASB (Lockman Foundation) — via api.bible:**
- Access via api.bible REST API (requires contacting support@api.bible for NASB access approval)
- **Most permissive licensed translation:** 1,000 verse limit, 50% work limit
- **Explicitly permits AI systems** to quote up to 1,000 verses per response
- Can cache up to 1,000 verses in SQLite with 14-day refresh cycle
- Web/app pages require full copyright notice with clickable link to lockman.org
- Required copyright: "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission. All rights reserved. www.Lockman.org"

**NLT (Tyndale House) — api.nlt.to:**
- Dedicated REST API: `GET /api/passages?ref=John.3.16&key=YOUR_KEY`
- Returns **HTML format** — must strip HTML tags for clean verse text during swap
- Also serves KJV and NTV (Spanish) — KJV endpoint could serve as fallback for our local KJV
- Anonymous: 50 verses/request, 500 requests/day. Key-based: 500 verses/request, 5,000 requests/day
- Cache conservatively with 14-day TTL
- Required copyright: "Scripture quotations are taken from the Holy Bible, New Living Translation, copyright ©1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved."

**NIV (Biblica) — via api.bible:**
- Access via api.bible REST API (requires contacting support@api.bible for NIV access approval)
- **Display only** — Biblica states: "Bible text may only be licensed for online website display and audio streaming, not for unrestricted download or redistribution"
- Cache for in-app display with 14-day TTL, but never include in downloadable exports
- Export dialog must gray out NIV option with explanation: "NIV is available for in-app reading only. Biblica's licensing does not permit downloadable copies."
- Required copyright: "Scripture quotations taken from The Holy Bible, New International Version® NIV® Copyright © 1973 1978 1984 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide."

#### Verse Cache Architecture — DHCP-Lease Rolling Cache

Inspired by DHCP lease renewal: verses are cached with a per-translation "lease duration." A background job proactively refreshes verses before expiry so the cache is always fresh and users always get instant responses. Verses that are no longer being read are allowed to expire naturally.

```
verse_cache table:
  - id (INTEGER PRIMARY KEY)
  - translation (TEXT)          -- 'esv', 'nasb', 'nlt', 'niv'
  - book (TEXT)
  - chapter (INT)
  - verse_start (INT)
  - verse_end (INT)
  - text (TEXT)
  - cached_at (DATETIME)        -- when this lease was last acquired/renewed
  - lease_duration_hours (INT)  -- per-translation: 24 for ESV, 168 for others
  - last_accessed_at (DATETIME) -- updated on every read (for LRU eviction)
  - access_count (INT DEFAULT 0) -- popularity tracking for eviction priority
```

**Per-Translation Lease Durations:**

| Translation | Storage Cap | Lease Duration | Renewal Trigger (75%) | Publisher's Refresh Language |
|-------------|------------|----------------|----------------------|------------------------------|
| BSB/KJV/WEB | N/A — local DB | Never expires | N/A | Public domain |
| **ESV** | ≤500 verses | **24 hours** | Renew at 18h | "Periodically clear" (no specific timeframe) |
| **NASB** | ≤1,000 verses | **7 days** | Renew at 5d 6h | No specific refresh requirement |
| **NLT** | ≤500 verses (conservative) | **7 days** | Renew at 5d 6h | No specific caching terms from Tyndale |
| **NIV** | ≤500 verses (api.bible) | **7 days** | Renew at 5d 6h | api.bible: "every 14 days or less" |

**Cache lifecycle (DHCP analogy):**

1. **Lease acquisition (DHCPDISCOVER → DHCPACK):** Verse needed for the first time → fetch from translation API → store in `verse_cache` with `cached_at = NOW()` and the translation's `lease_duration_hours`. Serve to user.
2. **Active lease (BOUND state):** While `NOW() < cached_at + lease_duration`, serve verse from cache instantly. Update `last_accessed_at` on every read.
3. **Proactive renewal (T1 renewal at 75%):** Background job runs hourly. For each verse where `NOW() > cached_at + (lease_duration * 0.75)` AND `last_accessed_at` is within the current lease period (verse is still being read): re-fetch from API, update `cached_at` and text. User never sees stale data.
4. **Lease expiry (EXPIRED state):** If a verse isn't accessed during its lease period, don't renew it. Mark as expired. Next access triggers a fresh fetch (back to step 1).
5. **Eviction (RELEASE):** Prune verses expired for >2x the lease period (nobody's reading them). Also enforce per-translation storage caps via LRU eviction — when approaching the cap, evict least-recently-accessed verses first.

**Background renewal job (runs every hour on custom server):**
```
1. SELECT verses WHERE NOW() > cached_at + (lease_duration * 0.75)
     AND last_accessed_at > cached_at  -- still being read
   GROUP BY translation
2. For each translation batch:
   a. Check rate limits (especially ESV: 60/min, 1000/hr)
   b. Batch verse references into passage ranges where possible
   c. Fetch from appropriate API
   d. UPDATE cached_at, text for each renewed verse
3. DELETE verses WHERE last_accessed_at < cached_at - lease_duration
     -- expired and not accessed: let them go
4. Per-translation cap check:
   a. COUNT verses per translation
   b. If ESV > 450 (approaching 500 cap): evict least-accessed expired first, then LRU active
   c. If NASB > 900 (approaching 1,000 cap): same eviction strategy
   d. If NLT/NIV > 450: same
```

**Why this is better than static TTL or no-cache:**
- **More compliant:** Proactive refresh means text is always current — exceeds what publishers ask for
- **More performant:** Users always get cached responses (no waiting for live API calls during reading)
- **More efficient:** Only renews verses people are actually reading; unused verses expire naturally
- **Rate-limit friendly:** Renewal happens in scheduled batches, not in burst during user requests
- **Storage-cap safe:** LRU eviction ensures we never exceed per-translation verse limits

#### Download/Export Flow

1. User reads study in BSB (default, from local DB)
2. User requests downloadable PDF/DOCX with a different translation
3. System checks translation export permissions:
   - **BSB/KJV/WEB:** Generate immediately, no expiry
   - **NASB:** Live api.bible call to swap verses (≤1,000). Generate file. Available for **23 hours**, then deleted. Copyright notice embedded.
   - **ESV:** Live api.esv.org call to swap verses (≤500). Generate file. Available for **23 hours**, then deleted. Copyright notice + esv.org link embedded.
   - **NLT:** Live api.nlt.to call to swap verses (≤500). Generate file. Available for **23 hours**, then deleted. Copyright notice embedded.
   - **NIV:** ❌ Export button disabled. Tooltip: "NIV is available for in-app reading only per Biblica's licensing terms."
4. AI does NOT process swapped text — mechanical substitution only
5. Expired downloads are cleaned up by a scheduled job

#### Attributions Page (`/attributions`)

A dedicated, beautifully designed page that centralizes all translation copyright notices, publisher acknowledgements, and required links. Serves both legal compliance and good faith.

**Why this page matters:**
- ESV requires a link to esv.org on every page displaying ESV text — abbreviation "(ESV)" on study pages links to this attributions page, which links to esv.org. Satisfies the "every page" requirement via one hop.
- NASB requires a clickable link to lockman.org on web/app pages — same approach.
- Centralizes all copyright notices instead of cluttering the immersive reader experience.
- Shows respect and good faith to publishers — strengthens any future licensing conversations.

**Page structure (Sage & Stone editorial design):**

```
/attributions

[Hero section — Bodoni Moda display heading]
"Scripture Translations"
[Literata body] "We are grateful to the publishers and translators who have
made these translations available for study and reflection."

[Translation cards — editorial layout, one per translation:]

  Berean Standard Bible (BSB)
  Public Domain — The Holy Bible, Berean Standard Bible, BSB is produced
  in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the
  Berean Bible Translation Committee. This text of God's Word has been
  dedicated to the public domain.
  → berean.bible

  King James Version (KJV)
  Public Domain — The King James Version is in the public domain in the
  United States.

  World English Bible (WEB)
  Public Domain — The World English Bible is a public domain translation
  produced by volunteers at eBible.org.
  → ebible.org

  New American Standard Bible (NASB)
  © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation
  Scripture quotations taken from the (NASB®) New American Standard Bible®,
  Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation.
  Used by permission. All rights reserved.
  → lockman.org

  English Standard Version (ESV)
  © 2001 by Crossway
  Scripture quotations are from the ESV® Bible (The Holy Bible, English
  Standard Version®), © 2001 by Crossway, a publishing ministry of Good
  News Publishers. Used by permission. All rights reserved. The ESV text
  may not be quoted in any publication made available to the public by a
  Creative Commons license. Users may not copy or download more than 500
  verses of the ESV Bible or more than one half of any book of the ESV Bible.
  → esv.org

  New Living Translation (NLT)
  © 1996, 2004, 2015 by Tyndale House Foundation
  Scripture quotations are taken from the Holy Bible, New Living Translation,
  copyright ©1996, 2004, 2015 by Tyndale House Foundation. Used by
  permission of Tyndale House Publishers, Carol Stream, Illinois 60188.
  All rights reserved.
  → tyndale.com

  New International Version (NIV)
  © 1973, 1978, 1984, 2011 by Biblica, Inc.™
  Scripture quotations taken from The Holy Bible, New International Version®
  NIV® Copyright © 1973 1978 1984 2011 by Biblica, Inc.™ Used by permission.
  All rights reserved worldwide. The NIV text is available for in-app reading
  only per Biblica's licensing terms.
  → biblica.com

[Footer note — Literata, stone-700:]
"All studies are generated using the Berean Standard Bible (BSB).
Other translations are available for reading and comparison through
the generous permissions of their respective publishers."
```

**In-app linking strategy:**
- Study reader: Translation abbreviation (e.g., "(ESV)") after each verse links to `/attributions#esv`
- Export files (PDF/DOCX): Include the specific translation's copyright notice inline + "For full attribution details, visit [app-url]/attributions"
- Footer: Small "Translations" link in app footer navigates to `/attributions`

**Implementation:** Part of Brief 07 (reader) or Brief 10 (onboarding) — simple static page with Sage & Stone styling, Bodoni Moda headings, and anchor IDs for each translation. No API calls needed.

#### Required Pre-Launch Steps for Tier 2/3
- [ ] Register for ESV API key at api.esv.org
- [ ] Register for NLT API key at api.nlt.to
- [ ] Contact support@api.bible to request NASB access approval
- [ ] Contact support@api.bible to request NIV access approval (display-only)
- [ ] Verify NASB is available on api.bible for non-commercial use
- [ ] Consider contacting Tyndale to confirm PDF export is acceptable for NLT

### Invite System & Email (Confirmed April 9, 2026)

**Email provider:** Resend (user already has an account). Used for invite emails, verification codes, and access request approval notifications. React email templates styled with Sage & Stone palette.

**Invite creation (any user):**
- All users can create invites — **2 invites per rolling 30-day window** for regular users, **unlimited for admins**
- Rate limit tracked by: `COUNT invite_codes WHERE created_by = ? AND created_at > datetime('now', '-30 days')`
- Every invite **requires a linked study** at creation time. Seeded studies make this available from day 1.
- Inviter selects a study → enters invitee's **name + email** → system generates a **cryptographically secure token** (URL-safe base64-encoded 24-byte random, 32 characters) → sends a personalized email via Resend ("David wants to study *The Life of Peter* with you") → also shows a **copyable invite link** for texting
- No SMS from the app — users copy the link to text it themselves

**Invite redemption flow:**
1. Invitee clicks link → `/join/[token]`
2. Page shows **partially redacted email** (e.g., `d***d@g****.com`) — "We sent a verification code to this email"
3. System sends a **6-digit verification code** to the full email via Resend (10-minute expiry, max 5 attempts)
4. User enters the code on the page
5. Code verified → page reveals inviter's name, linked study title, warm welcome ("Sarah wants to study *The Life of Peter* with you")
6. **Name and email pre-filled** (read-only from invite data). User creates a password.
7. Account created with `is_approved = 1`, `invited_by` set → flows into onboarding with linked study

**Access request flow (landing page → admin approval):**
1. Visitor experiences the cinematic landing page → finds "Request Access" (visible but not the focus — at the bottom after the full narrative)
2. Submits: name, email, reason for requesting access
3. Admin reviews in admin panel → approves → system auto-sends a warm email via Resend:
   > *[Name], your request to join [App Name] has been approved. We're glad you're here.*
   > *[Button: Create Your Account]*
   > *This link will expire in 7 days.*
4. Link goes to registration page with **name and email pre-filled** (read-only). User creates a password.
5. No linked study or personal inviter → onboarding step 1 uses **general warm welcome** (not "Sarah wants to study with you"), step 3 uses a **random seeded study**

**Schema changes to `invite_codes`:**
- `code` column: 32-char secure token (replaces 8-char alphanumeric)
- Add `invitee_name` (TEXT, required)
- Add `invitee_email` (TEXT, required)
- Add `linked_study_id` (INTEGER, FK → studies, ON DELETE SET NULL)
- `created_by` applies to all users, not just admins

**New table: `email_verification_codes`**
- `id`, `invite_code_id` (FK), `code` (6-digit), `email`, `expires_at`, `attempts` (INT, default 0), `verified` (BOOLEAN)

**Cinematic landing page (logged-out visitors):**
- **Not a registration form** — a scroll-driven narrative experience that IS the first point of ministry
- Communicates community, mission, and vision through Bodoni Moda typography, parallax Flux images, Sage & Stone palette
- App preview woven into narrative — study cards, highlights, reader glimpses appear naturally as the story unfolds
- "Request Access" lives at the bottom as a natural conclusion, not a CTA. Small, warm form (name, email, reason textarea)
- Someone who visits and never requests access should still walk away having encountered the mission
- **Implemented in Brief 06a** (separate from library to avoid packing Brief 06 too heavy)

**Brief 06a — Cinematic Landing Page (NEW):**
- Scroll-driven narrative sections with parallax and animation
- App preview components (study card, reader glimpse, highlight annotation)
- Request access form at bottom
- Responsive (mobile + desktop)
- `prefers-reduced-motion` support

### Mission & Voice (Confirmed April 9, 2026)

The mission statement is the source material for all app copy, onboarding language, empty states, and the About page. It is NOT displayed verbatim — it informs the voice.

**Name etymology — where it appears:**
| Surface | How the Koinar story appears |
|---------|------------------------------|
| **About page (Section 1)** | Full etymology woven into mission prose: "The name Koinar draws from two ancient words..." |
| **Onboarding Step 2 (Vision)** | Subtle — "fellowship" and "gathered" echo the roots without explaining them |
| **Landing page** | Optional narrative moment: ancient text fading in, merging into "Koinar" |
| **App footer** | "Koinar" links to `/about` |

**Core principles (in priority order):**
1. **Humility** — The app is a tool, not a replacement for church, mentorship, community, or pastoral direction. It actively encourages users to attend church, serve, and be involved.
2. **Information, not inspiration** — The app provides biblical context, connections, and original language insights. The Holy Spirit provides inspiration and direction. This distinction is critical and prevents the app from becoming a spiritual substitute.
3. **Community is the product** — Invite-only is not a growth hack; it IS the mission. You join because someone wants to study WITH you. The app is the table; the community is the meal.
4. **Accessibility** — For people who don't have years of deep contextual knowledge. The 7-step protocol does the heavy lifting so readers can focus on understanding.
5. **Together, not alone** — Solo study is great, group study is better. The Bible is meant to be read and shared. We were never meant to walk this journey alone.

**How the mission shapes the app:**

| Surface | Approach | Example |
|---------|----------|---------|
| **Onboarding Step 1** | Invitation is personal, not transactional | "Sarah wants to study with you" not "Sarah invited you" |
| **Onboarding Step 2 (Vision)** | Distilled mission — 2-3 sentences, cinematic Bodoni Moda | "This is a place to study Scripture together. We provide context and connections. The Holy Spirit provides direction. You were never meant to walk this journey alone." |
| **Onboarding Step 3 (Study)** | Tooltips reinforce community | "This highlight was left by someone in your community" |
| **Onboarding Step 4** | Points outward, not inward | "Your community is here. Start studying together." |
| **Empty states** | Encourage connection | "No highlights yet — invite someone to study this with you" |
| **Study generation** | Frame as communal act | "Generate a study to explore with your group" |
| **Invite creation** | Relational language | "Invite someone to study with you" |
| **About page** | Mission + convictions + attributions | See About page structure below |
| **App footer** | Links to `/about` | Warm, not legal |

**What it does NOT mean:**
- Never preachy or heavy-handed — warm, not lecturing
- Solo users should never feel guilty — support both modes without shaming either
- The mission is the voice guide, not user-facing copy to read verbatim

**About page (`/about`) — coming-soon version designed, production version expands it:**

The coming-soon about page (designed in `/app-designs/coming-soon/design-spec.md`) has 4 editorial sections:
- **Hero:** Full-bleed archway image, "ABOUT" label, KOINAR wordmark, etymology (koinonia + edah)
- **The Gap:** Split layout — image left, text right on warm parchment. Copy about Scripture feeling vast, personal study being sacred but communal study bringing focus.
- **The Resolution:** Split reversed — text left on deeper parchment with grain texture, image right. Copy about what Koinar does (generates contextual studies) and its community model (invite-only, library grows from contributions).
- **CTA:** Archway background with dark overlay, "A place is being prepared." tagline, "Coming soon." + "Join the waitlist" + "By invitation." + contact email.

The production about page (post-launch, Brief 06a era) will expand to include:
- "Our Convictions" section (Information not inspiration, Community not isolation, etc.)
- "Scripture Translations" section with publisher acknowledgements and copyright notices (replaces standalone `/attributions`)

All translation abbreviations in the reader (e.g., "(ESV)") will link to `/about#scripture-translations`.

### Image Generation (Flux)
- **Default model:** Flux 2 Pro (~$0.03-0.06/image depending on resolution)
- **Optional upgrade:** Flux 2 Max (~$0.15-0.25/image) selectable by admin for hero/featured images
- **Admin preview workflow:** Generate 2-3 variations side by side, admin picks the best one before committing to R2
- **Prompt testing:** Style options (cinematic, classical, illustrated) with scene description builder and AI-assisted prompt suggestion

---

## Execution Approach

**Sequential, brief-by-brief.** Each brief is a focused implementation session. Simple briefs may combine into one session; complex briefs may need two. After each phase: `npm run build`, `npm run lint`, deploy to Railway staging, smoke test.

---

## Brief Changes Required Before Execution

**Status: ✅ Briefs 02, 04, 05, 06a, 09, 10, 11 updated (April 10, 2026). Phases 0–3 + Briefs 07a–07e executed and complete (April 11–14, 2026). Brief 07f pending. Briefs 13, 08, 12, 15 pending — will be updated when their phase begins.**

These briefs need updates based on the confirmed decisions above:

### Brief 05 (Study Generation) — Major rewrite needed:
1. Change default model from `claude-sonnet-4-20250514` to `claude-opus-4-6`
2. Make model ID configurable via env var `AI_MODEL_ID`
3. **Remove free tier / rate limiting** — no admin-key generation for regular users
4. **Replace** the 3 formats (comprehensive/concise/narrative) with **Simple/Standard/Comprehensive**
5. **Add gift code system:**
   - New DB table: `study_gift_codes` (id, code, user_id, format_locked, max_uses, uses_remaining, created_by, created_at, expires_at)
   - API endpoint: `POST /api/gift-codes/redeem` — validates code belongs to user, has remaining uses, returns unlocked format
   - Generation route checks: user has BYOK key OR has active gift code for requested format
6. **Add programmatic audit trail:**
   - System prompt requires a `verification-audit` code fence at end of study
   - Post-generation parser extracts audit block, cross-references tool call IDs with actual tool executions
   - Flag studies where any cited verse lacks a matching tool call
   - Store audit results in `generation_metadata` JSON
7. **Strengthen system prompt:**
   - Add explicit rule: "Historical context marked with ⛰️ must be cite-quality facts only — verifiable through named sources (Josephus, Tacitus, Pliny, archaeological record). If a claim is uncertain, debated among scholars, or speculative, omit it entirely."
   - Add explicit rule: "You may NOT draw theological conclusions that cannot be backed by clear scriptural evidence. If the Bible does not clearly teach something, say so."
   - Add explicit rule: "Historical figures may be studied if they have at least a moderate presence in the Bible (multiple mentions, named in narratives)."
   - Add BYOK cost estimation display logic
8. Update cost estimates: Opus 4.6 at $5/$25 per MTok ≈ ~$2-4/comprehensive study

### Brief 04 (Auth & Invites) — Major rewrite needed:
1. Add `study_gift_codes` table to schema (or add as Brief 05 migration)
2. Gift codes are user-specific (tied to a user_id at creation time)
3. **Invite system overhaul:**
   - All users can create invites (2 per rolling 30 days for regular users, unlimited for admins)
   - Invite codes become 32-char cryptographically secure tokens (not 8-char alphanumeric)
   - Schema: add `invitee_name`, `invitee_email`, `linked_study_id` to `invite_codes`
   - New `email_verification_codes` table for 6-digit redemption codes
   - Invite creation UI: select study → enter invitee name + email → send email + show copyable link
4. **Invite redemption flow:**
   - `/join/[token]` page with email verification (6-digit code sent via Resend, 10-min expiry, 5 attempts max)
   - Post-verification: reveal inviter name + study, pre-fill name/email, user creates password
5. **Access request approval:**
   - Admin approves → auto-sends warm email via Resend with 7-day registration link
   - Registration page pre-fills name/email from access request
6. **Email infrastructure:** Resend integration for invite emails, verification codes, and approval notifications
7. **Remove raw code entry** — registration is now link-based (`/join/[token]`), not code-based (`/register?code=X`)

### Brief 09 (Admin Panel) — Additions:
1. Add "Gift Codes" admin section: create codes, assign to users, set format + use count, view redemption status
2. Add Flux model selector (Pro vs Max) in image generation UI
3. Add image preview workflow (generate 2-3 variations, select best)
4. **Access requests:** view pending requests, approve (triggers Resend email with registration link) or deny
5. **Invite management:** view all invites across users, see redemption status, rate limit overrides

### Brief 11 (Flux Images) — Updates:
1. Change API URL from `flux-2-pro` to support both Pro and Max endpoints
2. Add model selection parameter to `generateImage()` function
3. Add preview workflow: `generatePreviews(prompt, count: 2|3)` → returns multiple images for admin selection
4. Update cost estimation for both Pro and Max tiers

### Brief 13 (Translation API Layer) — Major rewrite needed:
1. **Re-add NASB** to the translation registry (was removed earlier, now confirmed as most permissive licensed translation)
2. **Restructure into 3 tiers** instead of 2:
   - Tier 1: BSB/KJV/WEB (public domain, local DB, launch)
   - Tier 2: NASB/ESV/NLT (licensed, display + export, post-launch)
   - Tier 3: NIV (licensed, display only, post-launch)
3. **DHCP-lease rolling cache system:**
   - `verse_cache` table with `cached_at`, `lease_duration_hours`, `last_accessed_at`, `access_count`
   - ESV: 24-hour lease, renew at 18h, ≤500 verse cap
   - NASB: 7-day lease, renew at 5d 6h, ≤1,000 verse cap
   - NLT: 7-day lease, renew at 5d 6h, ≤500 verse cap
   - NIV: 7-day lease, renew at 5d 6h, ≤500 verse cap (display only)
   - Background renewal job on custom server (runs hourly)
   - LRU eviction when approaching per-translation storage caps
4. **Per-translation API clients:**
   - ESV: `api.esv.org` with `Authorization: Token` header
   - NLT: `api.nlt.to` with `key` query parameter (returns HTML — must strip tags)
   - NASB: `api.bible` REST API (requires prior access approval from support@api.bible)
   - NIV: `api.bible` REST API (display-only, requires prior access approval)
5. **Export permission matrix:** NIV grayed out in export dialog with explanation
6. **Copyright notice registry:** Each translation has its own required notice, stored as constants. Used by reader, export engine, and attributions page.
7. **ESV/NASB link requirements:** Translation abbreviations in reader link to `/attributions#esv` and `/attributions#nasb` respectively
8. Update `TranslationId` type to include `'nasb'` again
9. **Attributions page** (`/attributions`): Static page with all copyright notices, publisher links, and acknowledgements. Editorial Sage & Stone design. Anchor IDs per translation for deep linking.

### Brief 07 (Immersive Reader) — Addition:
1. Translation abbreviations after verses (e.g., "(ESV)") link to `/attributions#[translation]`

### Brief 08 (Annotations & WebSockets) — Addition:
1. Cache renewal background job runs on the custom server alongside WebSocket server (hourly interval)

### Brief 12 (PDF/DOCX Export) — Updates:
1. Add per-translation export permission check before generating
2. NIV export returns error with user-friendly message
3. Each export includes the correct publisher-specific copyright notice
4. ESV exports include link to esv.org
5. NASB exports include link to lockman.org

### Brief 15 (Seed Content) — Update:
1. Change model to `claude-opus-4-6`
2. Update cost estimates (~$10 for 20 comprehensive studies at ~$0.50 each)
3. Add audit trail verification to each generated seed study

---

## Phase 0: Coming Soon + Deployment Skeleton (Brief 14, partial)

**Goal:** Get koinar.app live with an atmospheric teaser, and validate the Railway deployment pipeline.

### Phase 0 Prompts (4 prompts, sequential)

```
Prompt 0A (Sonnet) → Prompt 0B (Opus) → Prompt 0C (Sonnet) → Prompt 0D (Sonnet)
   scaffolding          design/UI           deploy main          setup develop
```

---

#### Prompt 0A — Next.js Scaffolding + Infrastructure

**Model: Sonnet | Mode: Direct Execution | Skill: `web-app-builder`**

> You are setting up the scaffolding for the Koinar coming soon teaser — a minimal Next.js app that will be deployed to Railway on the `main` branch. Another session will handle the design/UI — your job is the skeleton.
>
> **Read these files first:**
> - `/Users/davidgeorge/Desktop/study-app/briefs/14-deployment-railway.md` — Dockerfile and railway.json patterns
> - `/Users/davidgeorge/Desktop/study-app/app/.env` — environment variables (already filled in)
>
> **What to build (in `/Users/davidgeorge/Desktop/study-app/app/`):**
>
> 1. **Initialize Next.js 16 project** with TypeScript, Tailwind CSS 4, App Router. The `.env` file already exists in this directory — don't overwrite it.
> 2. **Install dependencies:** `resend`, `framer-motion`
> 3. **Configure fonts:** Import Bodoni Moda (display) and Literata (body) from Google Fonts via `next/font/google`. Export as CSS variables `--font-display` and `--font-body`. Apply to `<html>` element.
> 4. **API route** `GET /api/health` → returns `{ status: "ok", timestamp: new Date().toISOString() }`
> 5. **API route** `POST /api/waitlist/notify`:
>    - Validate email (required, valid format) from request body
>    - Use Resend SDK to add the email to an audience list (not the app DB — this is pre-launch email capture)
>    - Return 201 on success, 400 on invalid email, 409 if already subscribed
>    - Use `RESEND_API_KEY` from env
> 6. **Placeholder pages** at `/` and `/about`: Basic pages with "Koinar" as an `<h1>` using Bodoni Moda and a simple centered layout. The design will be implemented by a separate Opus session (Prompt 0B) — just make sure the font, routing, and Tailwind setup works.
> 7. **Dockerfile** for Railway: multi-stage Alpine build, standalone Next.js output, port 3000. Reference Brief 14 for the pattern.
> 8. **`railway.json`** with build and deploy config
> 9. **`next.config.ts`**: standalone output, any required settings
>
> **Do NOT include:** SQLite, better-sqlite3, argon2, Bible databases, auth, or any Brief 01-15 features. This is a minimal teaser only.
>
> **Verification:**
> - `npm run build` succeeds with standalone output
> - `docker build .` completes without errors
> - `npm run dev` shows placeholder page at localhost:3000 with Bodoni Moda font loaded
> - `POST /api/waitlist/notify` with a valid email returns 201
> - `GET /api/health` returns JSON with status and timestamp

---

#### Prompt 0B — Coming Soon Pages (Teaser + About)

**Model: Opus | Mode: Direct Execution | Skill: `frontend-design` (REQUIRED)**

> You are implementing the Koinar coming soon pages — the brand's first impression. The Next.js scaffolding, fonts, API routes, and Dockerfile are already built (Prompt 0A). Your job is to implement the two pages from the finalized design spec.
>
> **Read these files first (the design spec is the source of truth):**
> - `/Users/davidgeorge/Desktop/study-app/app-designs/coming-soon/design-spec.md` — **fully prescriptive spec, build exactly what is described**
> - `/Users/davidgeorge/Desktop/study-app/app-designs/coming-soon/mockups/coming-soon.html` — teaser page HTML reference
> - `/Users/davidgeorge/Desktop/study-app/app-designs/coming-soon/mockups/about.html` — about page HTML reference
> - `/Users/davidgeorge/Desktop/study-app/app/tailwind.config.ts` — current Tailwind config
>
> **Image assets:** `/app-designs/coming-soon/images/` — 8 Flux-generated images. Upload to Cloudflare R2 and serve with srcset (1x/2x for retina).
>
> **Use the `frontend-design` skill for all design work.**
>
> **Two pages to implement:**
>
> **Page 1: Teaser (`/`)**
> - Circadian mood system: morning (5am-12pm), day (12pm-6pm), evening (6pm-5am) with body class + URL override (`?mood=`)
> - 2 scroll-snap scenes per mood (6 total, only active mood's 2 visible)
> - Scene 1: Full-bleed background image with Ken Burns, vignette overlays, wordmark + sage rule + lead copy + scroll hint
> - Scene 2: Heavy overlay, body copy + mood-specific tagline + "Coming soon." + email form ("Join the waitlist") + "By invitation."
> - CSS cinemagraph effects per mood: dust motes, candle flicker, steam wisps, light shift
> - Fixed "ABOUT" navigation link (top-right, Literata 0.85rem, weight 600, uppercase)
> - Email form submits to `POST /api/waitlist/notify` with success/error/loading states
> - All copy, image assignments, and FX mappings are in the design spec
>
> **Page 2: About (`/about`)**
> - 4 viewport-filling sections in editorial split layout
> - Section 1 (Hero): Full-bleed archway image, "ABOUT" label, KOINAR wordmark, etymology, dust motes + light shift
> - Section 2 (The Gap): CSS Grid split — image left, text right on `#eae5dc` background
> - Section 3 (The Resolution): CSS Grid split reversed — text left on `#e0dace` with fractal noise grain texture, image right
> - Section 4 (CTA): Archway background with dark overlay, "A place is being prepared." + "Coming soon." + email form + "By invitation." + `hello@koinar.app`
> - Scroll reveal via Intersection Observer; hero elements triggered on load
> - All copy is in the design spec (final, approved, biblically vetted)
>
> **Shared across both pages:**
> - Sage & Stone design tokens (see spec § 3)
> - Bodoni Moda (display) + Literata (body) via Google Fonts
> - `prefers-reduced-motion: reduce` — all animations disabled, content immediately visible
> - Mobile-first responsive: 375px → 768px → 1440px breakpoints
> - Touch targets ≥44px
>
> **Verification:**
> - Teaser page loads with circadian mood matching local time
> - `?mood=morning|day|evening` overrides the mood
> - Ken Burns, cinemagraph effects, and scroll reveal all animate
> - About page renders all 4 sections with correct split layouts
> - Email form submits successfully on both pages, shows confirmation state
> - "ABOUT" link navigates from teaser to about page
> - `prefers-reduced-motion` disables all animations on both pages
> - Mobile layout correct at 375px (splits stack vertically)
> - `npm run build` succeeds

---

#### Prompt 0C — Railway Deployment

**Model: Sonnet | Mode: Direct Execution**

> Deploy the Koinar coming soon teaser to Railway. The app is fully built in `/Users/davidgeorge/Desktop/study-app/app/`.
>
> **Read:** `/Users/davidgeorge/Desktop/study-app/briefs/14-deployment-railway.md` for Railway config patterns.
>
> **Steps:**
> 1. Stage and commit all app files to `main` branch (the git repo is already initialized at `/Users/davidgeorge/Desktop/study-app/` with remote `git@github.com:th3fifthestate/koinar-study.git`)
> 2. Push `main` to remote
> 3. Create Railway project — connect to GitHub repo, deploy `main` branch
> 4. Set environment variables on Railway:
>    - `RESEND_API_KEY` (from `.env`)
>    - `NEXT_PUBLIC_APP_URL=https://koinar.app`
>    - `NODE_ENV=production`
>    - `PORT=3000`
> 5. Attach custom domains:
>    - `koinar.app` — primary domain
>    - `koinar.com` — 301 redirect to `koinar.app`
> 6. Wait for deployment to complete, verify health check
>
> **Do NOT create the `develop` branch yet** — that's the next prompt.
>
> **Verification:**
> - `https://koinar.app` serves the coming soon teaser
> - `https://koinar.app/about` serves the about page
> - `https://koinar.com` redirects to `https://koinar.app`
> - `https://koinar.app/api/health` returns `{ status: "ok" }`
> - Email form submits and reaches Resend on both pages
> - SSL certificates are active on both domains

---

#### Prompt 0D — Staging Environment

**Model: Sonnet | Mode: Direct Execution**

> Set up the staging environment for the full Koinar app build. Production (`main`) is already live with the coming soon teaser.
>
> **Steps:**
> 1. Create `develop` branch from `main`: `git checkout -b develop`
> 2. Push `develop` to remote: `git push -u origin develop`
> 3. In Railway, configure branch-based deployment:
>    - `develop` branch → deploys to its own Railway service (staging)
>    - Staging URL: `staging.koinar.app` (via Cloudflare Access)
> 4. Add persistent volume on the staging service:
>    - Mount path: `/data`
>    - Size: 1GB (sufficient for app.db + Bible databases during development)
> 5. Set staging environment variables (same as production, except):
>    - `NEXT_PUBLIC_APP_URL=https://staging.koinar.app`
>    - `NODE_ENV=production`
> 6. Verify staging deploys independently from production
>
> **Do NOT start any Brief 01-15 work yet.** This prompt only validates the staging pipeline.
>
> **Verification:**
> - `develop` branch deploys to staging URL
> - Staging serves the same teaser (confirming the deploy works)
> - Production (`main`) is unaffected
> - Persistent volume mounts at `/data`
> - Future pushes to `develop` trigger staging deploys only

---

### Phase 0 Execution Summary

| Prompt | Model | Depends On | What It Does |
|--------|-------|------------|--------------|
| **0A** | Sonnet | Nothing | Next.js init, fonts, API routes, Dockerfile |
| **0B** | **Opus** | 0A | Teaser + About pages from design spec (images, moods, effects, copy) |
| **0C** | Sonnet | 0B | Commit, push, deploy to Railway, custom domains |
| **0D** | Sonnet | 0C | Create develop branch, staging environment |

**Why first:** Railway deployment catches Docker build failures immediately. Plus, koinar.app goes live from day one — building anticipation while the full app is developed on the staging branch.

**Phase 0 Status: ✅ COMPLETE (April 11, 2026)**
- Teaser live at koinar.app (production, `main` branch)
- Staging at staging.koinar.app (behind Cloudflare Access, `develop` branch)
- Security audit completed (6 docs in `founders-files/security-audit/`)
- CSP hardened, env validation added, CLAUDE.md security rules in place
- All staging env vars set including unique SESSION_SECRET and ENCRYPTION_KEY
- Persistent volume at `/data` on staging
- Documentation synced for Phase 1

---

## Phase 1: Foundation (Briefs 01 → 02 → 03)

**Goal:** Bootable app with database layer.

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| **01 — Project Scaffolding** | **Sonnet** | Plan Mode | `create-next-app`, Tailwind 4 + shadcn/ui, Sage & Stone CSS tokens, Bodoni Moda + Literata fonts, folder structure. Use `frontend-design` skill for design system setup. |
| **02 — Database Schema** | **Sonnet** | Direct Execution | 12 tables + `study_gift_codes` table, SQLite DDL, migration runner, TypeScript types, query helpers. |
| **03 — Bible Database Setup** | **Sonnet** | Direct Execution | Copy 4 databases. 40+ query functions. Reference existing code at `queries.ts` but adapt, don't copy. Databases total ~120MB. |

**Critical files:**
- `briefs/01-project-scaffolding.md` (613 lines)
- `briefs/02-database-schema.md` (328 lines)
- `briefs/03-bible-database-setup.md` (424 lines)
- `/Documents/bible-study-skills/data/docs/BIBLE_DATABASE_GUIDE.md` — database schemas
- `/Documents/AI-Projects/mybiblestudy-nextjs/src/lib/db/bible/queries.ts` — reference patterns

**Verification:**
- `npm run dev` starts without errors
- `npm run build` succeeds with standalone output
- Home page renders with Bodoni Moda + Literata fonts and Sage & Stone colors
- `.dark` class on `<html>` toggles evening mode
- App database creates tables on first run (including `study_gift_codes`)
- Bible queries return correct data (test: Genesis 1:1, Strong's H1234, cross-refs for John 3:16)
- Docker build still succeeds

**Phase 1 Status: ✅ COMPLETE (April 11, 2026)**
- All three briefs executed and reviewed
- Post-review hardening applied (15 fixes across security, correctness, and architecture):
  - Dark mode: removed duplicate `.dark` block that overrode Sage & Stone palette
  - Dockerfile: added `python3 make g++` for native module compilation + build-time env placeholders
  - CSP: added `wss:`, `api.anthropic.com`, `api.esv.org`, `api.scripture.api.bible` to `connect-src`
  - Security: verification code attempt cap (5 max), removed `is_admin` from `createUser`, `consumeGiftCode` now accepts opaque `code` string instead of integer PK
  - Data layer: `StudySummary` type for list queries (no `content_markdown`), session CRUD functions, `waitlist.email` UNIQUE constraint, `globalThis` singleton for HMR safety
  - Bible layer: FTS database opened readonly (pre-built at 9.2MB), FTS sanitizer blocks `-` operator, LIKE wildcard escaping on `searchVerses`
  - Architecture: unified `config.ts` to consume from Zod-validated `env.ts` (single source of truth), stub routes export correct HTTP methods (POST/GET/PATCH)
  - FTS search index pre-built: 631 results for "love", porter stemming, snippet highlighting
- TypeScript compiles clean (`tsc --noEmit` passes)

---

## Phase 2: Auth + AI Engine (Briefs 04 → 05) ✅ COMPLETE (April 11, 2026)

**Goal:** Auth system and study generation with Opus 4.6.

**Completion notes:**
- Brief 04 (Auth & Invites): Full auth system with iron-session + argon2, Resend email integration, invite flow with 6-digit verification, waitlist approval, access request from landing/about pages, account lockout, middleware. Post-review hardening: rate limiting on all public endpoints, atomic invite claiming, atomic verification attempts, transaction-wrapped user creation.
- Brief 05 (Study Generation): Vercel AI SDK v6 `streamText` with `stepCountIs(30)`, 7 Bible tools, 3 format types, BYOK encryption, gift code system, audit trail. Post-review fixes: `totalUsage` for accurate token counting, deferred gift code consumption (consumed after study saved), slug collision retry, tag length validation.
- Landing page auth redesigned: embedded "Join the Community" + "Sign In" buttons with animated inline forms, login page redirects to `/`.
- All auth API responses scrubbed of sequential user IDs.

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| **04 — Auth & Invites** | **Sonnet** | Plan Mode | iron-session + argon2, Resend email integration, user-created invites (2/month, 32-char secure tokens), email verification, access request approval with auto-email, account lockout, middleware. No design work — pure backend logic. |
| **05 — Study Generation** | **Sonnet** | Plan Mode | Hardest brief. Vercel AI SDK v6 + Claude Opus 4.6, streaming with tool calling, 7-step protocol, audit trail, BYOK encryption, gift codes. Use `context7` skill for AI SDK v6 docs. No design work — pure backend. |

**Critical files:**
- `briefs/04-auth-and-invites.md` (563 lines)
- `briefs/05-study-generation-engine.md` (1001 lines) — **updated and executed**
- `/Documents/bible-study-skills/skills/bible-reference/SKILL.md` — 7-step protocol
- `/Documents/AI-Projects/mybiblestudy-nextjs/src/lib/ai/tools.ts` — tool definition patterns

**Risk:** Vercel AI SDK v6 `streamText` / `tool` / `maxSteps` API may have changed since brief was written. Check docs first.

**Verification:**
- **Invite creation:** User selects study → enters invitee name/email → email sent via Resend → copyable link shown
- **Invite rate limit:** Regular user blocked after 2 invites in 30 days; admin unlimited
- **Invite redemption:** Click `/join/[token]` → see redacted email → enter 6-digit code from email → inviter name + study revealed → create password → account created with `is_approved = 1`
- **Access request:** Submit from landing page → admin approves → approval email sent → user registers with pre-filled name/email
- Login/logout cycle works
- Account lockout after 5 failed attempts
- Protected routes redirect to login
- **BYOK user:** Add API key → generation UI appears → generate study "Study the life of Peter" → streaming response with real Bible data
- **Non-BYOK user:** Generation UI is hidden, only library/reader visible
- **Gift code:** Admin creates code → user redeems → generation UI unlocks for that format → generates study → code use count decrements → UI locks when depleted
- Tool calls execute against Bible databases (not hallucinated verses)
- **Audit trail:** Generated study includes verification block; all cited verses traceable to tool calls
- BYOK cost advisory shows estimated cost before generation
- No study cites a verse without a corresponding database tool call

---

## Phase 3: Reading Experience (Briefs 06 → 06a → 07) — ✅ COMPLETE

**Goal:** Users can browse the library, read studies, and non-logged-in visitors experience the cinematic landing page.

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| ~~**06 — Study Library**~~ | ~~**Opus**~~ | ~~Plan Mode~~ | ✅ COMPLETE |
| ~~**06a — Cinematic Landing Page**~~ | ~~**Opus**~~ | ~~Direct Execution~~ | ✅ COMPLETE |
| ~~**07 — Immersive Study Reader**~~ | ~~**Sonnet**~~ | ~~Plan Mode~~ | ✅ COMPLETE |

---

## Phase 3a: Contextual Knowledge Layer (Briefs 07a → 07f)

**Goal:** Entity knowledge base, annotation pipeline, contextual drill-down UI for the study reader, and comprehensive verse-level entity mapping across the Bible.

### Execution Order and Parallelism

```
GROUP 1 (parallel):    Brief 07 (reader) ✅  +  Brief 07a (schema + data) ✅
                           │                            │
                           │                   ┌────────┴────────┐
GROUP 2 (parallel):        │             Brief 07b ✅       Brief 07e ✅
                           │            (annotation         (content
                           │             pipeline)          generation)
                           │                 │                  │
                           └────────┬────────┘                  │
GROUP 3 (sequential):        Brief 07c (popover + drawer) ✅    │
                                 │                              │
GROUP 4 (parallel):          Brief 07d ✅      +        Brief 07f ✅
                            (branch map)          (book-by-book mapping)
```

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| ~~**07 — Immersive Study Reader**~~ ✅ | ~~**Sonnet**~~ | ~~Plan Mode~~ | ✅ COMPLETE |
| ~~**07a — Entity Schema + TIPNR + Seeds**~~ ✅ | ~~**Sonnet**~~ | ~~Plan Mode~~ | ✅ COMPLETE — Full TIPNR import (3,142 persons), Strong's-suffixed entity IDs |
| ~~**07b — Annotation Pipeline**~~ ✅ | ~~**Sonnet**~~ | ~~Plan Mode~~ | ✅ COMPLETE |
| ~~**07c — Knowledge Layer UI (Popover + Drawer)**~~ ✅ | ~~**Opus**~~ | ~~Plan Mode~~ | ✅ COMPLETE |
| ~~**07d — Branch Map**~~ ✅ | ~~**Opus**~~ | ~~Direct Execution~~ | ✅ COMPLETE — Radial-forest SVG layout, vitest infrastructure |
| ~~**07e — Entity Content Generation**~~ ✅ | ~~**Opus**~~ | ~~Direct Execution~~ | ✅ COMPLETE — Full 3,142 persons via Opus 4.6 batch (~$550-600 one-time cost) |
| ~~**07f — Book-by-Book Cross-Reference Mapping**~~ ✅ | ~~**Sonnet**~~ | ~~Direct Execution~~ | ✅ COMPLETE — 31,102 BSB verses scanned, 18,428 deterministic + 3,721 TIPNR-disambiguated + 3,590 AI-resolved. 99.2% high confidence, ~$1-2 AI cost. Saul/Paul mislink corrected post-run. |

**Parallel execution notes:**
- **07 + 07a run in parallel** — reader and entity schema are independent ✅ COMPLETE
- **07b + 07e run in parallel** — both need only 07a complete ✅ COMPLETE
- **07c waits for 07 + 07b** — needs the reader surface and annotation data ✅ COMPLETE
- **07d + 07f run in parallel** — 07d ✅ COMPLETE, 07f ✅ COMPLETE
- **07f produces data that 07c's UI will render** — but 07f doesn't depend on 07c (just populates `entity_verse_refs`). Running 07f after 07e means disambiguation prompts have full entity content for context.

**Verification (07a–07f all verified):**
- ✅ Entity database: 6 tables created, 3,675 total entities (3,142 persons + 533 non-persons)
- ✅ TIPNR: 9,766 relationship edges, 46,758 TIPNR verse refs, full family data populated
- ✅ Entity IDs: Universal Strong's-suffixed format (`NAME_STRONGS`, e.g. `JAMES_G2385I`)
- ✅ Entity content: 3,140/3,142 persons generated via Opus 4.6 batch, three-tier prose (quick_glance, summary, full_profile)
- ✅ Citations: 46,017 total, 100% pass rate on citation verifier (approved sources aligned with `Section3_Revised_v2.md`)
- ✅ Source verification: 3,674/3,675 entities source_verified=1 (1 genuine format error: SICARII)
- ✅ Annotation pipeline: new studies get entity annotations; old studies annotated on first load
- ✅ Annotator disambiguation: Strong's-suffixed IDs for Herod (4), James (4), Mary (5), Joseph (3), Judas (4), Lazarus (2), Saul (2) variants
- ✅ Entity underlines: subtle dotted sage underlines on entity terms in reader
- ✅ Quick Glance: tap underline → popover with 1-2 sentence summary
- ✅ Context drawer: "Explore" → drawer with Summary/Full Profile, related entities, citations
- ✅ Drill-down: tap related entity → breadcrumb updates, drawer navigates
- ✅ Branch Map: radial-forest SVG layout, colored nodes, labeled edges, overlay integration in reader
- ✅ Toggle: entity annotations can be toggled on/off, preference persists
- ✅ Cross-reference mapping (07f): 31,102 BSB verses scanned across all 66 books. 18,428 deterministic + 3,721 TIPNR-disambiguated + 3,590 AI-resolved refs. 419 false positives pruned. 99.2% high confidence. 3,563/3,675 entities have verse refs (97% coverage).

**Design note (logged April 12, 2026):** The home/library page hero image currently reuses the coming soon landing page imagery. It needs a separate set of biblically based landscape images with atmospheric immersion, each matched to the user's time of day (morning, midday, evening, night). Address during a home page visual polish pass — not blocking current briefs.

**Phase 3a Status: ✅ ALL COMPLETE (April 11–14, 2026). Briefs 07a–07f done.**

Completion notes (07a–07e):
- **Entity disambiguation overhaul (April 13-14):** Original 07a imported only 100 top TIPNR persons with bare-name IDs (e.g. `JAMES`), causing disambiguation collisions. Post-07e, we ran a full TIPNR reimport: migrated all 92 existing entities to Strong's-suffixed IDs (`migrate-entity-ids-to-strongs.ts`), rewrote `import-tipnr.ts` to produce `NAME_STRONGS` IDs for all 3,142 persons with content-preserving upserts, submitted full Anthropic batch ($550-600 via Opus 4.6), and expanded the citation verifier's approved sources per `Section3_Revised_v2.md`.
- **Scripts created:** `migrate-entity-ids-to-strongs.ts`, `audit-tipnr-disambiguation.ts`, `fix-source-verified.ts`. Modified: `import-tipnr.ts`, `prepare-entity-batch.ts`, `process-entity-batch.ts`.
- **Annotator updated:** `lib/entities/annotator.ts` disambiguation map rewritten with Strong's-suffixed IDs for all ambiguous biblical names. System prompt (`lib/ai/system-prompt.ts`) updated with new ID format and examples.
- **Citation verifier expanded:** `lib/entities/citation-verifier.ts` approved sources aligned with `founders-files/Section3_Revised_v2.md` (v2.0, April 13, 2026) — added primary ancient sources, rabbinic literature, early church fathers, ISBE, Fausset's, Tyndale, OpenBible.info, Sefaria, Perseus, LacusCurtius, archaeological artifacts, museums. Viz.Bible intentionally excluded per v2 reclassification.
- **Branch map (07d):** Radial-forest SVG layout with deterministic coordinates, vitest test infrastructure (9/9 passing), reader overlay integration with open/close flow. Code reviewed: stable `entityStackRef` pattern, O(1) `nodeById` Map, SVG title ordering fix.
- **Final entity layer stats (07a–07e):** 3,675 entities, 9,766 relationships, 46,017 citations, 51,003 verse refs, 100% citation pass rate, 99.97% source_verified.

Completion notes (07f — April 14, 2026):
- **Pipeline:** 3-phase architecture — Phase 1 (trie-based deterministic scanning of all 31,102 BSB verses), Phase 1b (TIPNR local disambiguation, $0), Phase 2 (Sonnet AI fallback, ~$1-2).
- **Results:** 18,428 deterministic matches, 3,721 TIPNR-disambiguated, 3,590 AI-resolved, 419 false positives pruned by AI. 165 remaining ambiguous (96% resolution rate). 99.2% high confidence.
- **Saul/Paul correction (post-run):** 29 "Saul" refs in Acts were mislinked to King Saul (`SAUL_H7586G`). Corrected to Paul (`PAUL_G3972G`) with `manual_correction` source. Acts 13:22 preserved as King Saul (genuine reference). Added "Saul" and "Saul of Tarsus" as aliases on Paul entity. Added `saul` to annotator `AMBIGUOUS_NAMES` with context keywords (tarsus, damascus, barnabas vs king, david, jonathan).
- **Test coverage expanded:** 89 new tests added for queries.ts (25), annotator.ts (11), citation-verifier.ts (53). Total: 107/107 passing.
- **Final verse ref stats:** ~49,880 total refs in entity_verse_refs (46,758 TIPNR + 18,428 deterministic + 3,721 TIPNR-disambiguated + 3,590 AI - 419 pruned - 6 deduped - 29 corrected + overlaps). 3,563/3,675 entities have verse refs (97% entity coverage).

---

## Phase 4: Collaboration + Admin (Briefs 08 → 11 → 09)

**Goal:** Real-time annotations, image generation, and admin management.

**⚠️ Architecture shift:** Brief 08 introduces a custom Node.js server wrapping Next.js for WebSocket support. This changes how `npm run dev` and `npm start` work. After this phase, the dev command becomes `tsx watch src/server.ts` instead of `next dev`.

| Prompt | Model | Mode | Key Notes |
|--------|-------|------|-----------|
| **08a — Annotations Backend** ✅ | **Sonnet** | Plan Mode | Custom `server.ts` wrapping Next.js, WebSocket server with per-study rooms, REST CRUD for annotations, `data-offset-start/end` attribute system for markdown-to-HTML offset mapping, database queries. Pure architecture. |
| **08b — Annotations UI** ✅ | **Opus** | Direct Execution | Text selection detection, highlight rendering overlay, annotation popovers, community toggle, real-time sync visual feedback. Use `frontend-design` skill. **Opus: selection UX and popover design need real taste.** |
| **11 — Flux Images** | **Sonnet** | Direct Execution | Flux Pro + Max, admin preview workflow, R2 upload. Pure API integration — no user-facing design. |
| **09 — Admin Panel** | **Sonnet** | Direct Execution | Dashboard, gift codes, waitlist, users, studies, images, analytics. Functional admin UI — Shadcn defaults, no custom design needed. |

**Execution order:** 08a ✅ → 08b ✅ → **11 (next)** → 09. 11 before 09 because admin panel's image section triggers Flux — building 11 first means 09 integrates directly.

**Critical files:**
- `briefs/08-annotations-and-websockets.md` — ✅ COMPLETE
- `briefs/11-flux-image-integration.md` — pre-implementation notes added 2026-04-15 (5 issues flagged)
- `briefs/09-admin-panel.md` — pre-implementation notes added 2026-04-15 (auth pattern + existing routes)

**Brief 11 readiness audit (2026-04-15):** Codebase is ~60% prepared. Already in place: `config.r2.*`, `config.ai.fluxApiKey`, `@aws-sdk/client-s3`, `requireAdmin()` helper, admin route group, `study_images` table (partial — needs additive migration), `featured_image_url` subquery in study queries. Missing: `sharp` install, `seasonal_images` table, `lib/images/` directory. See brief's pre-implementation notes section for the 5 issues (schema mismatch, auth pattern, `FLUX_API_URL` bug, base64 payload size, /src/ path prefix).

**Risk:** Custom server breaks Turbopack HMR. During Phases 1-3, use `next dev`. Only switch to custom server in Phase 4. Consider conditional entrypoint for frontend-only work.

**Verification:**
- ✅ Custom server starts and serves Next.js pages normally
- ✅ WebSocket connects on `/ws`
- ✅ Highlight text in reader → annotation popover appears
- ✅ Save annotation (public/private) → persists
- ✅ Second browser window sees annotation in real-time
- ✅ Community toggle hides/shows others' annotations
- Flux API generates image from prompt (test both Pro and Max)

### 08a — Annotations Backend ✅ COMPLETE
**Completed:** 2026-04-14 | **Model:** Sonnet | **Mode:** Plan Mode → Direct Execution

**Delivered:**
- Custom `server.ts` wrapping Next.js with WebSocket upgrade handling
- WebSocket server: per-study rooms, iron-session cookie auth, presence tracking, annotation broadcast
- REST CRUD: GET/POST/DELETE `/api/studies/[id]/annotations`, with auth, validation, rate limiting
- Module-level broadcaster pattern connecting API routes to WebSocket broadcasts
- `is_own: boolean` pattern replacing user_id exposure in API payloads

**Review fixes (security):**
- Added `studyIsAccessible()` guard on DELETE annotation route
- Added study access check in WebSocket `join` handler
- Stabilized WS client hook with callback refs to prevent reconnect on parent render

### 08b — Annotations UI ✅ COMPLETE
**Completed:** 2026-04-14 | **Model:** Opus | **Mode:** Direct Execution

**Delivered:**
- `highlight-layer.tsx`: DOM text-node walker applying colored `<mark>` elements by character offset
- `use-text-selection.ts`: Text selection hook computing offsets relative to content container
- `annotation-popover.tsx`: Radix popover for creating highlights (5 colors) and notes on selection
- `annotation-notes.tsx`: Margin notes with desktop dot indicators + mobile inline expansion
- `community-toggle.tsx`: Community annotation toggle with live reader count badge
- `use-study-annotations.ts`: Annotation state management with optimistic updates + WS sync
- `study-reader.tsx` / `study-header.tsx`: Integration of all annotation controls

**Review fixes:**
- Fixed stale closure in `deleteAnnotation` via functional setState snapshot
- Fixed offset mismatch by computing endOffset from raw text before trim
- Replaced `surroundContents` with `extractContents`+`appendChild` for cross-node highlights
- Added scroll listener for margin note position recalculation
- Removed unused `userId` prop from StudyReader

**Known issue:** Custom server (`tsx watch server.ts`) crashes on Node.js 24 with `AsyncLocalStorage` error — tsx + Next.js 16 compatibility. Use Node.js 22 LTS for now.
- Admin preview: 2-3 variations generated, admin selects one, selected image uploads to R2
- Admin panel: CRUD for invite codes, **gift codes**, waitlist, users, studies, images, analytics
- Docker build succeeds with custom server

---

## Phase 5: Onboarding + Translation (Briefs 10 → 13)

**Goal:** First-time user experience and multi-translation support.

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| **10 — Onboarding** | **Opus** | Direct Execution | 4-step Framer Motion flow, two paths (invited vs waitlist). Use `frontend-design` skill. **Opus: onboarding is the second impression after the teaser — animation pacing, copy warmth, and step transitions need real design sense.** |
| **13 — Translation API** | **Sonnet** | Plan Mode | 3-tier translation system, 4 API clients, DHCP cache, export permissions. Pure backend — no design. Needs brief rewrite first. Use `context7` for API docs. |

**Critical files:**
- `briefs/10-onboarding-journey.md` (984 lines)
- `briefs/13-translation-api-layer.md` (1166 lines) — **needs major rewrite per "Brief Changes" section**

**Risks:**
- **ESV rate limits:** 5,000 queries/day, 1,000/hr, 60/min. Since we don't cache ESV, every in-app swap and every export triggers live calls. Batch verse lookups (e.g., "Romans 8:1-39" as one call) are critical to stay within limits.
- **api.bible access approval:** NASB and NIV require contacting support@api.bible for access. This is a blocking dependency — must be done before implementing these translations.
- **NLT HTML stripping:** api.nlt.to returns HTML, not plain text. Need robust HTML-to-text conversion for clean verse swaps.

**Verification:**
- New user → onboarding flow triggers with all 4 animated steps
- Inviter's name appears in welcome step
- Sample study renders in immersion step
- `onboarding_completed` flag set; returning users skip onboarding
- **Translation selector in reader** shows all available translations grouped by tier
- Switching BSB → ESV swaps verse text (first call fetches from API + caches with 24h lease; subsequent reads serve from cache)
- Switching BSB → NASB swaps verse text (fetches + caches with 7-day lease)
- Switching BSB → NLT swaps verse text (HTML stripped, cached with 7-day lease)
- Switching BSB → NIV swaps verse text (display only — cached with 7-day lease)
- **Cache renewal:** Background job renews ESV verses at 18h, others at 5d 6h. Verify by checking `cached_at` timestamps update without user action.
- **Cache eviction:** Verses not accessed within their lease period expire and are pruned. Per-translation caps enforced (500 ESV, 1,000 NASB, 500 NLT/NIV).
- **NIV export disabled** — export dialog grays out NIV with explanation
- ESV/NASB/NLT exports work with correct copyright notices
- Translation abbreviations in reader link to `/attributions#[translation]`
- **Attributions page** renders with all copyright notices, publisher links, and anchor IDs
- Public domain translations (BSB/KJV/WEB) have no restrictions on display or export

---

## Phase 6: Export + Seed + Final Deploy (Briefs 12 → 15 → 14-final)

**Goal:** Export functionality, seed content, and production launch.

**⚠️ Prerequisite:** App name and domain should be chosen before this phase.

| Brief | Model | Mode | Key Notes |
|-------|-------|------|-----------|
| **12 — PDF/DOCX Export** | **Sonnet** | Plan Mode | Markdown → AST, PDFKit PDF with Unicode fonts, DOCX via `docx` npm, download API with 23h expiry. Pure backend — no user-facing design. |
| **15 — Seed Content** | **Sonnet** | Direct Execution | 20 seed studies via Brief 05 engine using Opus 4.6. ~$10 API cost. Script-based batch generation. |
| **14 — Final Deploy** | **Sonnet** | Direct Execution | Dockerfile, Railway config, env vars, custom domain, R2, health check. Infrastructure only. |

**Critical files:**
- `briefs/12-pdf-docx-export.md` (1532 lines)
- `briefs/15-seed-content-generation.md` (1371 lines) — **needs model + cost updates**
- `briefs/14-deployment-railway.md` (805 lines)

**Risk (Brief 12):** PDFKit requires TTF/OTF font files for Hebrew/Greek. Bundle Noto Sans Hebrew and Noto Sans (OFL license, free) and register with PDFKit before rendering.

**Verification:**
- Download study as PDF in BSB → all formatting correct, Greek/Hebrew renders, no expiry
- Download as DOCX in ESV → copyright notice + esv.org link embedded, 23h expiry, then auto-deleted
- Download in NASB → copyright notice + lockman.org link, 23h expiry
- Download in NLT → copyright notice, 23h expiry
- **NIV export attempt → grayed out with explanation message**
- All 20 seed studies generated and stored
- Each seed follows 7-step protocol — **audit trail confirms no hallucinated verses**
- Production Railway deployment serves full app
- WebSockets work in production
- Persistent volume retains app.db across redeploys
- R2 images load from production URL
- Custom domain resolves correctly

---

## Summary

| Phase | Prompts | Opus | Sonnet | Sessions | Milestone | Status |
|-------|---------|------|--------|----------|-----------|--------|
| 0 | 0A, 0B, 0C, 0D | 0B (teaser + about design) | 0A, 0C, 0D | 1-2 | Deployable shell on Railway | ✅ |
| 1 | 01, 02, 03 | — | All 3 | 2-3 | Bootable app with databases | ✅ |
| 2 | 04, 05 | — | Both | 2-3 | Auth + AI study generation | ✅ |
| 3 | 06, 06a, 07 | 06, 06a, 07 | — | 3-5 | Library + landing page + reader | ✅ |
| 3a | ~~07a, 07b, 07c, 07d, 07e, 07f~~ | 07c, 07d, 07e | 07a, 07b, 07f | 5-7 | Contextual knowledge layer | ✅ |
| 4 | 08a, 08b, 11, 09 | 08b (annotation UI) | 08a, 11, 09 | 3-4 | Annotations, images, admin | 08a ✅, 08b ✅ |
| 5 | 10, 13 | 10 (onboarding) | 13 | 2-3 | Onboarding + translations | Pending |
| 6 | 12, 15, 14 | — | All 3 | 2-3 | Export, seed, launch | Pending |
| **Total** | **26 prompts** | **10 Opus** | **16 Sonnet** | **~21-29** | **Production launch** | |

---

## Critical Risks & Mitigations

1. **Opus 4.6 cost management:** At $5/$25 per MTok, comprehensive studies cost ~$0.50 each. Seed generation (20 studies) ≈ $10. For BYOK users, show clear cost estimates before generation (Simple ~$0.15, Standard ~$0.28, Comprehensive ~$0.50).
2. **Custom server breaks Turbopack HMR (Brief 08).** Mitigation: use `next dev` for Phases 1-3. Only switch to custom server in Phase 4.
3. **Text selection offset mapping (Brief 08).** Mitigation: use `data-offset-start/end` attributes during markdown-to-HTML rendering pass.
4. **Circadian color system (Brief 07).** Mitigation: use `suncalc` package, cache geolocation in localStorage, fallback to timezone.
5. **Vercel AI SDK v6 API surface.** Mitigation: check current docs via context7 before Brief 05 implementation.
6. **PDFKit Hebrew/Greek fonts (Brief 12).** Mitigation: bundle Noto Sans Hebrew + Noto Sans (free, OFL license).
7. **ESV API rate limits (Brief 13).** ESV has the strictest rate limits (5,000/day, 1,000/hr, 60/min) and a 24-hour cache lease. First-time verse fetches and lease renewals consume API calls. Mitigation: use batch passage lookups (e.g., "Romans 8:1-39" as one query instead of 39), stagger renewal job to stay under 60/min, and pre-warm cache for popular studies during off-peak hours.
8. **api.bible access for NASB/NIV (Brief 13).** NASB and NIV require contacting support@api.bible for access approval. This is a **blocking dependency** for Tier 2/3 translations. Mitigation: submit access requests early (during Phase 4) so approval is in place by Phase 5.
9. **NIV export prohibition.** Biblica explicitly prohibits "uncontrolled downloads." Mitigation: NIV is display-only — export button is disabled with clear user messaging explaining why.
10. **NLT API returns HTML.** api.nlt.to returns HTML-formatted text, not plain text. Mitigation: build a robust HTML-to-text stripper that preserves verse text while removing tags, tested against edge cases (italic text, footnote markers, paragraph breaks).
11. **Flux content moderation.** Biblical scenes may trigger moderation filters. Mitigation: test prompts iteratively via admin preview workflow, refine negative prompts.
12. **Translation licensing compliance.** Each translation has different rules for caching, display, export, and attribution. Mitigation: build a `TranslationRegistry` with per-translation config objects that enforce rules programmatically (cache TTL, export allowed, copyright notice, required links). Never hardcode — always go through the registry.
13. **Email deliverability (Resend).** Invite and verification emails must reach inboxes, not spam. Mitigation: configure SPF/DKIM/DMARC on the sending domain once purchased. Use Resend's domain verification. During development, use Resend's sandbox mode.
