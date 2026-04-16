# Brief 09: Admin Panel

**Recommended mode: Direct Execution**

> **Branch:** All work on `develop`. Commit when complete with message: `Brief 09: Admin panel — dashboard, gift codes, waitlist, users, studies, images`
> **Path note:** This project uses `app/` not `app/src/`.

---

## ⚠️ Pre-Implementation Notes (Updated April 15, 2026 — Readiness Audit)

> **READ THIS FIRST.** The body of this brief was written before Briefs 03, 04, 08, and 11 shipped. Several sections show outdated paths, helpers, or routes. Use this corrections list as the source of truth — when the body conflicts with what's below, the corrections win.

### A. Path conventions

- **Project uses `app/`, NOT `app/src/`.** Throughout this brief, every `/src/app/...`, `/src/components/...`, `/src/lib/...` path is wrong. Translate to `app/app/...`, `app/components/...`, `app/lib/...`.
- **Route group convention:** the codebase uses `app/admin/`, NOT `app/(admin)/admin/`. The brief's `(admin)` parens are wrong. Mirror the existing structure (`app/admin/images/page.tsx` already lives there).

### B. Auth pattern (mandatory rewrite)

- **Do NOT** define a local `requireAdmin()` helper. **Section 11 of this brief is obsolete — skip it entirely.** One already exists at `app/lib/auth/middleware.ts`:
  ```ts
  import { requireAdmin } from "@/lib/auth/middleware";
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  // auth.user.userId, auth.user.username, auth.user.isAdmin
  ```
- All route handlers in this brief that use `getSession()?.userId` + a manual `is_admin` SQL lookup must be rewritten to use `requireAdmin()`. (CLAUDE.md §2.)
- Bare import `@/lib/auth` does **not** resolve — no barrel exists. Use `@/lib/auth/middleware` or `@/lib/auth/session`.
- DB import: brief shows `import { db } from '@/lib/db'`. Actual export is `getDb()` from `@/lib/db/connection`.

### C. Schema delta required (v5 → v6)

The brief assumes `users.is_banned` exists. **It does NOT.** Add a v6 migration in `app/lib/db/connection.ts` (and bump `SCHEMA_VERSION = 6`):

```sql
ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
```

Verified to exist already (no migration needed): `users.is_admin`, `users.is_approved`, `waitlist`, `invite_codes`, `study_gift_codes`, `admin_actions`, `study_images`, `seasonal_images`, `annotations`, `favorites`, `study_tags`. Do **not** run any `CREATE TABLE` from this brief — the schema is already in place.

### D. Field- and table-name corrections

- `studies.author_id` (brief) → **`studies.created_by`** (actual).
- `tags` table (brief) → **`study_tags`** (actual; columns are `study_id`, `tag_name`).
- `studies.featured_image_url` (brief) is **NOT a stored column** — it's derived via subquery from `study_images` in `app/lib/library/queries.ts`. Brief 11 already designates the hero image via `study_images.is_hero = 1`. **Drop any `UPDATE studies SET featured_image_url = …` step** — set `is_hero = 1` on the chosen image instead.
- `admin_actions` columns: `admin_id`, `action_type` (NOT `action`), `target_type`, `target_id`, `details` (JSON text). The waitlist flow already uses this — copy that pattern.

### E. Already-implemented routes (do NOT recreate — wire to them)

| Route | State |
|-------|-------|
| `app/app/api/admin/waitlist/route.ts` and `[id]/route.ts` | ✅ Functional (Brief 04) — approve generates token, sends Resend email, logs admin_actions. Wire the UI page to these. |
| `app/app/api/admin/images/{generate,attach,reorder,suggest-prompt,seasonal,[id]}/route.ts` | ✅ Functional (Brief 11). **Section 8 of this brief — "Image Generation API Route" — is obsolete.** Do not duplicate. |
| `app/app/api/admin/studies/route.ts` | ✅ Stub-ish: returns `id, title, content_markdown` only. Needs expansion to power the studies admin table (add filters, pagination, joined counts). |
| `app/app/api/invites/route.ts` | User-facing (uses `requireAuth`), not admin. Don't touch. |
| `app/app/api/studies/[id]/annotations/*` | ✅ Brief 08 — leave alone. |
| `app/app/admin/images/page.tsx` | ✅ Full Brief 11 UI (~730 lines). The sidebar's "Images" link points here. |

### F. Stub routes this brief OWNS (currently return 501)

- `app/app/api/admin/users/route.ts` — implement GET (list, search, sort, paginate).
- `app/app/api/admin/invite-codes/route.ts` — implement GET + POST (per Section 6).

### G. Brief 11 contract — fixes needed before Brief 09 can import cleanly

1. `app/lib/images/flux.ts` exports `generateImage`, **not** `generateFluxImage`. Update brief's references.
2. `FluxGenerateRequest` is declared but **not exported** from `flux.ts`. **Add `export` to that interface as part of Brief 09 setup** (one-line change) so the admin code can import it.
3. `estimateCost(count, model)` — verify arg order before invoking.

### H. Missing shadcn primitives

Run before starting UI work:

```
npx shadcn@latest add table alert-dialog
```

(All other shadcn components the brief uses — `dialog`, `select`, `textarea`, `badge`, `tabs` — are already installed.)

### I. Admin shell is a placeholder today

`app/app/admin/layout.tsx` is `<div>{children}</div>`; `app/app/admin/page.tsx` is `<div>Admin</div>`. Replace both as the very first task (Sections 1–3 of this brief).

### J. Resend is already wired

`app/lib/email/resend.ts` exports `sendApprovalEmail` (and `sendInviteEmail`, `sendVerificationCode`). The waitlist approve route already calls it. Don't introduce a parallel Resend client.

### K. Recommended task order

1. **Schema v6 migration** (`users.is_banned`).
2. **Brief 11 export fix** (`export interface FluxGenerateRequest`).
3. **Install shadcn primitives** (table, alert-dialog).
4. **Admin shell** — real layout, sidebar, auth guard at `app/app/admin/layout.tsx`.
5. **Dashboard** + stats query module + activity feed.
6. **Users page** — UI + flesh out stub `GET` + new `PATCH /api/admin/users/[id]`.
7. **Waitlist page** — UI only (routes exist).
8. **Invite codes page** — UI + flesh out stub `GET`.
9. **Gift codes page** — UI + new `GET/POST /api/admin/gift-codes` + `[id]/route.ts`.
10. **Studies curation page** — UI + new `PATCH/DELETE /api/admin/studies/[id]` + expand existing `GET`.
11. **Analytics page** — 4 simple queries.
12. **Sidebar entry for Images** — link to existing `app/admin/images/page.tsx`.
13. **Consolidate `logAdminAction`** into `app/lib/admin/actions.ts` (the waitlist route currently inlines this — refactor to use the shared helper).

---

## Overview

Build a moderate-scope admin panel for managing users, waitlist applications, invite codes, studies, image generation, and basic analytics. The admin panel is functional, not flashy — Shadcn/ui defaults with clean tables and forms.

---

## Critical Context

- **Project root**: `/Users/davidgeorge/Desktop/study-app/app/`
- **Stack**: Next.js 16 (App Router, TypeScript, React 19), Tailwind CSS 4, Shadcn/ui, better-sqlite3, iron-session
- **Database**: SQLite `app.db`
- **Image generation**: Flux 2 Pro and Flux 2 Max APIs (Black Forest Labs) — `https://api.bfl.ai/v1/flux-2-pro` / `https://api.bfl.ai/v1/flux-2-max`
- **Image storage**: Cloudflare R2 (S3-compatible)
- **Design reference**: `/Users/davidgeorge/Desktop/study-app/founders-files/DESIGN-DECISIONS.md`

### Key Design Decisions

- Admin panel is moderate scope — launch features only
- Admin access: `is_admin` flag on the users table
- Image generation is admin-triggered only (not automatic) for quality control
- Flux 2 Pro costs ~$0.03-0.06/image (Pro) or ~$0.15-0.25/image (Max)
- Invite codes are the primary access control mechanism
- Gift codes: admin-created codes for gifting study generation to specific users

---

## Database Schema (Relevant Tables)

> **🛑 DO NOT RUN ANY `CREATE TABLE` STATEMENTS BELOW.** All tables in this section already exist (verified 2026-04-15). The only schema work this brief requires is the v6 migration adding `users.is_banned` (see Pre-Implementation Notes §C). Treat the SQL below as documentation of current shape only — and note these column-name corrections vs. the actual schema:
> - `admin_actions` uses `action_type`, NOT `action`.
> - `studies` uses `created_by`, NOT `author_id`.
> - `studies` has `category_id` (FK to `categories`), NOT a freeform `category` text column.
> - Tags live in `study_tags` (`study_id`, `tag_name`), NOT a `tags` table.

These should already exist from prior briefs. Verify they exist or create them.

```sql
-- Users table (should exist from auth brief)
-- Ensure these columns exist:
-- is_approved INTEGER NOT NULL DEFAULT 0
-- is_admin INTEGER NOT NULL DEFAULT 0
-- is_banned INTEGER NOT NULL DEFAULT 0

-- Waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by INTEGER REFERENCES users(id),
  approval_token TEXT UNIQUE,
  approval_token_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

-- Invite codes table (should exist)
CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  linked_study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE SET NULL,
  used_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Study gift codes (admin-created)
CREATE TABLE IF NOT EXISTS study_gift_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  format_locked TEXT NOT NULL CHECK (format_locked IN ('simple', 'standard', 'comprehensive')),
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_remaining INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- Admin actions log
CREATE TABLE IF NOT EXISTS admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, -- 'approve_user', 'ban_user', 'create_invite', 'feature_study', etc.
  target_type TEXT, -- 'user', 'study', 'waitlist', 'invite_code'
  target_id INTEGER,
  details TEXT, -- JSON string with additional context
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## File Structure

> **🛑 The tree below uses obsolete `src/` paths and `(admin)` route group. The corrected tree (matches the actual codebase) is immediately after.** Strike-through entries are already implemented by Briefs 04 / 11.

### Corrected file tree (USE THIS)

```
app/
  app/
    admin/                                # NOT (admin)
      layout.tsx                          # CREATE — replace placeholder shell
      page.tsx                            # CREATE — Dashboard (replace placeholder)
      users/page.tsx                      # CREATE
      waitlist/page.tsx                   # CREATE
      invite-codes/page.tsx               # CREATE
      gift-codes/page.tsx                 # CREATE
      studies/page.tsx                    # CREATE
      images/page.tsx                     # ✅ EXISTS (Brief 11) — link only
      analytics/page.tsx                  # CREATE
    api/
      admin/
        stats/route.ts                    # CREATE
        users/route.ts                    # MODIFY — flesh out 501 stub (GET)
        users/[id]/route.ts               # CREATE — PATCH (approve, ban, admin)
        waitlist/route.ts                 # ✅ EXISTS (Brief 04)
        waitlist/[id]/route.ts            # ✅ EXISTS (Brief 04)
        invite-codes/route.ts             # MODIFY — flesh out 501 stub (GET)
        gift-codes/route.ts               # CREATE — GET + POST
        gift-codes/[id]/route.ts          # CREATE — GET
        studies/route.ts                  # MODIFY — expand existing GET
        studies/[id]/route.ts             # CREATE — PATCH + DELETE
        images/**                         # ✅ EXISTS (Brief 11)
  components/
    admin/                                # CREATE directory
      admin-sidebar.tsx
      data-table.tsx
      stat-card.tsx
      activity-feed.tsx
    ui/                                   # add table + alert-dialog (see §H)
  lib/
    admin/
      actions.ts                          # CREATE — logAdminAction helper
      # NO middleware.ts — use @/lib/auth/middleware (see §B)
    auth/middleware.ts                    # ✅ EXISTS — requireAdmin()
    db/connection.ts                      # MODIFY — bump SCHEMA_VERSION → 6
    email/resend.ts                       # ✅ EXISTS — sendApprovalEmail
    images/{flux,r2,queries,prompt-builder,seasonal}.ts  # ✅ EXISTS (Brief 11)
    images/flux.ts                        # MODIFY — add `export` to FluxGenerateRequest
```

### Original (obsolete) tree — DO NOT FOLLOW

```
src/
  app/
    (admin)/
      admin/
        layout.tsx              -- Admin layout with sidebar, auth guard
        page.tsx                -- Dashboard
        users/
          page.tsx              -- User management
        waitlist/
          page.tsx              -- Waitlist management
        invite-codes/
          page.tsx              -- Invite code management
        gift-codes/
          page.tsx              -- Gift code management
        studies/
          page.tsx              -- Study curation
        images/
          page.tsx              -- Image generation & management
        analytics/
          page.tsx              -- Basic analytics
  components/
    admin/
      admin-sidebar.tsx         -- Sidebar navigation
      data-table.tsx            -- Reusable data table component
      stat-card.tsx             -- Dashboard stat card
      activity-feed.tsx         -- Recent activity list
      image-generator.tsx       -- Flux image generation form
  lib/
    admin/
      middleware.ts             -- Admin auth check
      actions.ts                -- Admin action logging
    services/
      flux.ts                   -- Flux API integration
      r2.ts                     -- Cloudflare R2 upload
  app/
    api/
      admin/
        stats/
          route.ts              -- Dashboard stats
        users/
          route.ts              -- User CRUD
          [id]/
            route.ts            -- Single user actions
        waitlist/
          route.ts              -- Waitlist CRUD
          [id]/
            route.ts            -- Single waitlist actions (PATCH triggers Resend email)
        invite-codes/
          route.ts              -- Invite code CRUD
        gift-codes/
          route.ts              -- Gift code CRUD
          [id]/
            route.ts            -- Single gift code actions
        studies/
          route.ts              -- Study management
          [id]/
            route.ts            -- Single study actions
        images/
          generate/
            route.ts            -- Trigger Flux generation
          [id]/
            route.ts            -- Image management
```

---

## 1. Admin Layout

**File**: `/src/app/(admin)/admin/layout.tsx`

Server Component that:
- Checks `is_admin` on the current session
- Redirects to `/library` if not admin
- Renders sidebar + content area

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.userId) redirect('/');

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.userId) as { is_admin: number } | undefined;
  if (!user?.is_admin) redirect('/library');

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {children}
      </main>
    </div>
  );
}
```

---

## 2. Admin Sidebar

**File**: `/src/components/admin/admin-sidebar.tsx`

```tsx
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Clock, KeyRound,
  Gift, BookOpen, Image, BarChart3
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/waitlist', label: 'Waitlist', icon: Clock },
  { href: '/admin/invite-codes', label: 'Invite Codes', icon: KeyRound },
  { href: '/admin/gift-codes', label: 'Gift Codes', icon: Gift },
  { href: '/admin/studies', label: 'Studies', icon: BookOpen },
  { href: '/admin/images', label: 'Images', icon: Image },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r bg-card p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
        <p className="text-xs text-muted-foreground">Manage your community</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <Link href="/library" className="text-xs text-muted-foreground hover:text-foreground">
          Back to Library
        </Link>
      </div>
    </aside>
  );
}
```

---

## 3. Dashboard

**File**: `/src/app/(admin)/admin/page.tsx`

Server Component showing overview stats and recent activity.

### Stats Cards

Display these key metrics:
- Total users (with "approved" / "pending" breakdown)
- Total studies (public / private breakdown)
- Total annotations
- Pending waitlist entries (highlighted in amber/red if > 0)
- Studies generated this week
- Studies generated this month

### Stat Card Component

**File**: `/src/components/admin/stat-card.tsx`

```tsx
interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  trend?: string; // e.g., "+5 this week"
  highlighted?: boolean; // for urgent items like pending waitlist
}
```

### Recent Activity Feed

**File**: `/src/components/admin/activity-feed.tsx`

Query the last 20 entries from `admin_actions` table + recent user registrations + recent studies.

```tsx
interface ActivityItem {
  type: 'user_joined' | 'study_created' | 'waitlist_entry' | 'admin_action';
  description: string;
  timestamp: string;
}
```

### SQL Queries for Dashboard

```sql
-- Total users
SELECT COUNT(*) as total, SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved FROM users;

-- Total studies
SELECT COUNT(*) as total, SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_count FROM studies;

-- Total annotations
SELECT COUNT(*) as total FROM annotations;

-- Pending waitlist
SELECT COUNT(*) as pending FROM waitlist WHERE status = 'pending';

-- Studies this week
SELECT COUNT(*) as count FROM studies WHERE created_at >= datetime('now', '-7 days');

-- Studies this month
SELECT COUNT(*) as count FROM studies WHERE created_at >= datetime('now', '-30 days');

-- Recent activity (combine multiple queries)
SELECT 'user_joined' as type, username as description, created_at as timestamp
FROM users ORDER BY created_at DESC LIMIT 5
UNION ALL
SELECT 'study_created', title, created_at FROM studies ORDER BY created_at DESC LIMIT 5
UNION ALL
SELECT 'waitlist_entry', name || ' (' || email || ')', created_at FROM waitlist ORDER BY created_at DESC LIMIT 5
ORDER BY timestamp DESC LIMIT 20;
```

---

## 4. User Management

**File**: `/src/app/(admin)/admin/users/page.tsx`

### Table Columns

| Column | Type | Sortable |
|--------|------|----------|
| Username | text | yes |
| Email | text | yes |
| Joined | date | yes |
| Studies | count | yes |
| Approved | boolean badge | no |
| Admin | boolean badge | no |
| Banned | boolean badge | no |
| Actions | buttons | no |

### Actions

- **Approve**: Set `is_approved = 1` (only shown if not approved)
- **Ban/Unban**: Toggle `is_banned` flag
- **Grant Admin**: Set `is_admin = 1` (with confirmation dialog)
- **Revoke Admin**: Set `is_admin = 0` (with confirmation dialog)

### Search

- Search bar filtering by username or email (client-side for small user counts, or server-side)

### API

```
GET    /api/admin/users                -- List users (supports ?search=, ?sort=, ?page=)
PATCH  /api/admin/users/[id]           -- Update user (approve, ban, admin status)
```

**PATCH body examples:**
```json
{ "is_approved": true }
{ "is_banned": true }
{ "is_admin": true }
```

Every admin action should be logged to `admin_actions` table.

---

## 5. Waitlist Management

**File**: `/src/app/(admin)/admin/waitlist/page.tsx`

### Table Columns

| Column | Type |
|--------|------|
| Name | text |
| Email | text |
| Message | text (truncated, expandable) |
| Status | badge (pending/approved/denied) |
| Submitted | date |
| Actions | buttons |

### Actions

- **Approve**: Changes status to 'approved'. Generates an `approval_token` (32-char URL-safe base64), sets `approval_token_expires_at` to 7 days from now, and sends an approval email via Resend with a registration link `/welcome/[token]`. The email should be warm: "[Name], your request to join Koinar has been approved..."
- **Deny**: Changes status to 'denied'.

### Filter

- Filter by status: All, Pending, Approved, Denied
- Default view: Pending first

### API

```
GET    /api/admin/waitlist              -- List waitlist entries (?status=, ?page=)
PATCH  /api/admin/waitlist/[id]         -- Update status (triggers Resend email on approve)
```

**PATCH body:**
```json
{ "status": "approved" }
```

When approving:
1. Generate a 32-char URL-safe base64 `approval_token`
2. Set `approval_token_expires_at` to 7 days from now
3. Set `reviewed_by` to admin's user ID and `reviewed_at` to now
4. Send approval email via Resend with registration link `/welcome/[token]`
5. Return the updated waitlist entry in the response

---

## 6. Invite Code Management

**File**: `/src/app/(admin)/admin/invite-codes/page.tsx`

### Overview

Invite codes are 32-char cryptographically secure tokens. Regular users create invites via the app UI (limited to 2 per rolling 30 days). The admin panel shows all invites across all users and their redemption status.

### Table Columns

| Column | Type |
|--------|------|
| Code | monospace text (truncated, copyable) |
| Inviter Name | username |
| Invitee Name | text |
| Invitee Email | text |
| Linked Study | study title (link) |
| Status | badge (active/used/inactive) |
| Created | date |
| Used At | date or "---" |

### Actions

- **Copy**: Copy full code to clipboard
- Admin can view all invites across users and see redemption status

### API

```
GET    /api/admin/invite-codes          -- List all codes across users (?status=, ?page=)
```

---

## 6b. Gift Code Management

**File**: `/src/app/(admin)/admin/gift-codes/page.tsx`

### Create Gift Code

Form fields:
- **User**: Searchable dropdown to select the recipient user
- **Format**: Select format (simple / standard / comprehensive)
- **Number of uses**: Numeric input (default 1)
- **Expiration date**: Optional date picker

### Table Columns

| Column | Type |
|--------|------|
| Code | monospace text (truncated) |
| Recipient User | username |
| Format | badge (simple/standard/comprehensive) |
| Max Uses | number |
| Uses Remaining | number |
| Created | date |
| Status | badge (active/depleted/expired) |

### Notes

- No revoke needed -- codes expire when depleted or past expiration
- Status is derived: "active" if uses_remaining > 0 and not expired, "depleted" if uses_remaining = 0, "expired" if past expires_at

### API

```
GET    /api/admin/gift-codes            -- List gift codes (?status=, ?page=)
POST   /api/admin/gift-codes            -- Create gift code { user_id, format_locked, max_uses, expires_at? }
GET    /api/admin/gift-codes/[id]       -- Get gift code details
```

---

## 7. Study Curation

**File**: `/src/app/(admin)/admin/studies/page.tsx`

### Table Columns

| Column | Type |
|--------|------|
| Title | text (link to study reader) |
| Author | text |
| Category | badge |
| Public | boolean |
| Featured | boolean (star icon) |
| Favorites | count |
| Annotations | count |
| Created | date |
| Actions | buttons |

### Actions

- **Feature/Unfeature**: Toggle `is_featured` flag (starred studies appear prominently in library)
- **Make Public/Private**: Toggle `is_public` flag
- **Edit Tags**: Inline tag editing (add/remove tags)
- **Edit Category**: Dropdown to change category
- **Delete**: With confirmation dialog. Cascades to annotations, favorites, tags, images.
- **View**: Link to `/study/[slug]`

### API

```
GET    /api/admin/studies               -- List all studies (?search=, ?category=, ?page=)
PATCH  /api/admin/studies/[id]          -- Update study fields
DELETE /api/admin/studies/[id]          -- Delete study (cascade)
```

**PATCH body examples:**
```json
{ "is_featured": true }
{ "is_public": false }
{ "category": "new-testament" }
{ "tags": ["acts", "gentiles", "peter"] }
```

---

## 8. Image Generation

> **🛑 OBSOLETE — already shipped by Brief 11.**
> The admin images page lives at `app/app/admin/images/page.tsx` (~730 lines) and the routes (`generate`, `attach`, `reorder`, `suggest-prompt`, `seasonal`, `[id]`) all exist under `app/app/api/admin/images/`. **Do not recreate any of this.** Brief 09's only remaining image work is:
> 1. Add the **Images** entry to the admin sidebar pointing to `/admin/images`.
> 2. Add an "Images" stat card on the dashboard (count from `study_images`).
>
> Skip the rest of this section. The R2 client (`app/lib/images/r2.ts`), Flux client (`app/lib/images/flux.ts`), and prompt builder are all in place and unchanged.

---

### Original (pre-Brief-11) section — kept for reference only

**File**: `/src/app/(admin)/admin/images/page.tsx`

This is the interface for generating Flux images and attaching them to studies.

### UI Flow

1. **Select a study**: Dropdown or search to select a study
2. **View existing images**: Show current images for the selected study (if any)
3. **Generate new image**:
   - **Model selector**: Dropdown to choose between "Flux 2 Pro (~$0.03-0.06)" and "Flux 2 Max (~$0.15-0.25)". Cost display updates based on selected model.
   - **Prompt input**: Large textarea for the Flux prompt
   - **Auto-suggest prompt**: Button that generates a suggested prompt based on the study's title and summary (client-side template, not an AI call)
   - **Dimensions**: Width/Height inputs (default 1024x768, landscape for hero images)
   - **Generate Previews button**: Generates 2-3 variations side by side using the selected model
4. **Preview and select**: Show the 2-3 generated variations side by side. Admin picks the best one with a "Select" button on each preview.
5. **Attach to study**: Only the selected image is uploaded to R2 and linked to the study. Non-selected previews are discarded.
6. **Manage existing images**: Reorder (drag or up/down buttons), delete, replace, edit captions

### Auto-Suggest Prompt Template

```typescript
function suggestPrompt(study: { title: string; summary: string; category: string }): string {
  const basePrompt = `Biblical scene illustration, cinematic lighting, warm tones, oil painting style.`;
  // Extract key themes from title
  return `${basePrompt} Scene depicting: ${study.title}. ${study.summary?.slice(0, 100) || ''}`;
}
```

### Flux API Integration

> **Note (updated April 14, 2026):** The admin panel does NOT implement its own Flux client.
> Brief 11 creates the canonical Flux API client at `lib/images/flux.ts` with dual
> Pro/Max model support, `generatePreviews()` for 2-3 variations, cost estimation,
> and polling logic. This section imports from that module.

**Imports from Brief 11** (`lib/images/flux.ts`):

```typescript
import {
  generateFluxImage,
  generatePreviews,
  estimateCost,
  type FluxGenerateRequest,
} from '@/lib/images/flux';
```

**Admin image generation API route** (`app/api/admin/images/generate/route.ts`):

```typescript
import { requireAdmin } from '@/lib/auth';
import { generatePreviews, type FluxGenerateRequest } from '@/lib/images/flux';

export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json();
  const { prompt, width, height, model, count } = body as {
    prompt: string;
    width?: number;
    height?: number;
    model?: 'flux-2-pro' | 'flux-2-max';
    count?: 2 | 3;
  };

  if (!prompt?.trim()) {
    return Response.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const request_: FluxGenerateRequest = {
    prompt,
    width: width || 1024,
    height: height || 768,
    model: model || 'flux-2-pro',
  };

  // Generate 2-3 preview variations for admin selection
  const previews = await generatePreviews(request_, count || 3);

  return Response.json({
    previews: previews.map((p) => ({
      taskId: p.taskId,
      index: p.index,
      // Return base64 data URL for preview display
      dataUrl: `data:image/png;base64,${p.buffer.toString('base64')}`,
    })),
  });
}
```

**Key integration points:**
- Model selector dropdown calls `estimateCost(model, count)` to show live cost preview
- "Generate Previews" button hits the route above, returns 2-3 variations
- Admin selects one preview → that image buffer is uploaded to R2 (see below)
- Non-selected previews are discarded (never uploaded)

### Cloudflare R2 Upload

**File**: `/src/lib/services/r2.ts`

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { config } from "@/lib/config";

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

const BUCKET = config.r2.bucketName;
const PUBLIC_URL = config.r2.publicUrl;

export async function uploadImageToR2(
  imageBuffer: Buffer,
  key: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteImageFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
```

### Image Generation API Route

**File**: `/src/app/api/admin/images/generate/route.ts`

```typescript
export async function POST(request: Request) {
  // 1. Verify admin
  // 2. Parse body: { studyId, prompt, width, height }
  // 3. Call generateFluxImage()
  // 4. Download the image from the Flux URL
  // 5. Upload to R2 with key: `studies/${studyId}/${timestamp}.jpg`
  // 6. Insert into study_images table
  // 7. Return the image record

  const body = await request.json();
  const { studyId, prompt, width, height } = body;

  // Generate
  const fluxImageUrl = await generateFluxImage({ prompt, width, height });

  // Download from Flux
  const imageRes = await fetch(fluxImageUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // Upload to R2
  const key = `studies/${studyId}/${Date.now()}.jpg`;
  const r2Url = await uploadImageToR2(imageBuffer, key);

  // Get next sort order
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM study_images WHERE study_id = ?'
  ).get(studyId) as { max_order: number };

  // Save to database
  const result = db.prepare(`
    INSERT INTO study_images (study_id, image_url, caption, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(studyId, r2Url, prompt.slice(0, 200), maxOrder.max_order + 1);

  // If this is the first image, set it as featured
  const study = db.prepare('SELECT featured_image_url FROM studies WHERE id = ?').get(studyId);
  if (!study.featured_image_url) {
    db.prepare('UPDATE studies SET featured_image_url = ? WHERE id = ?').run(r2Url, studyId);
  }

  // Log admin action
  // ...

  return Response.json({
    image: {
      id: result.lastInsertRowid,
      study_id: studyId,
      image_url: r2Url,
      caption: prompt.slice(0, 200),
      sort_order: maxOrder.max_order + 1,
    }
  }, { status: 201 });
}
```

---

## 9. Basic Analytics

**File**: `/src/app/(admin)/admin/analytics/page.tsx`

Simple analytics page with tables (no charting library needed for MVP — tables are fine).

### Sections

**Studies per week (last 8 weeks):**
```sql
SELECT
  strftime('%Y-%W', created_at) as week,
  COUNT(*) as count
FROM studies
WHERE created_at >= datetime('now', '-56 days')
GROUP BY week
ORDER BY week DESC;
```

**Most popular studies (by favorites, top 10):**
```sql
SELECT s.title, s.slug, COUNT(f.id) as favorites
FROM studies s
LEFT JOIN favorites f ON f.study_id = s.id
WHERE s.is_public = 1
GROUP BY s.id
ORDER BY favorites DESC
LIMIT 10;
```

**Most active users (by studies created, top 10):**
```sql
SELECT u.username, COUNT(s.id) as studies, COUNT(DISTINCT a.id) as annotations
FROM users u
LEFT JOIN studies s ON s.author_id = u.id
LEFT JOIN annotations a ON a.user_id = u.id
GROUP BY u.id
ORDER BY studies DESC
LIMIT 10;
```

**Annotation activity (last 7 days):**
```sql
SELECT
  DATE(created_at) as day,
  SUM(CASE WHEN type = 'highlight' THEN 1 ELSE 0 END) as highlights,
  SUM(CASE WHEN type = 'note' THEN 1 ELSE 0 END) as notes
FROM annotations
WHERE created_at >= datetime('now', '-7 days')
GROUP BY day
ORDER BY day DESC;
```

---

## 10. Reusable Data Table Component

**File**: `/src/components/admin/data-table.tsx`

A reusable table component used across all admin pages. Use Shadcn's `Table` component.

```tsx
interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}
```

Features:
- Column headers with sort indicators
- Search bar at top (optional)
- Pagination controls at bottom
- Empty state
- Loading state (skeleton rows)

---

## 11. Admin Auth Middleware

> **🛑 OBSOLETE — skip this entire section.**
> `requireAdmin()` already exists at `app/lib/auth/middleware.ts` with the shape `{ user, response }`. Use it everywhere:
> ```ts
> import { requireAdmin } from "@/lib/auth/middleware";
> const auth = await requireAdmin();
> if (auth.response) return auth.response;
> // auth.user.userId, auth.user.username, auth.user.isAdmin
> ```
> Do NOT create `app/lib/admin/middleware.ts`. Do NOT use `getSession()` + manual `is_admin` SQL lookups. The reference code below is wrong (uses non-existent `db` import and missing-barrel `@/lib/auth/session` import shape).

---

### Original (obsolete) section — kept for reference only

**File**: `/src/lib/admin/middleware.ts`

Helper function for API routes:

```typescript
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function requireAdmin(): Promise<{ userId: number } | Response> {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.userId) as { is_admin: number } | undefined;
  if (!user?.is_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId: session.userId };
}
```

Usage in API routes:
```typescript
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  // auth.userId is the admin's user ID
}
```

---

## 12. Admin Action Logging

**File**: `/src/lib/admin/actions.ts`

```typescript
import { db } from '@/lib/db';

export function logAdminAction(
  adminId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: Record<string, unknown>
) {
  db.prepare(`
    INSERT INTO admin_actions (admin_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, action, targetType || null, targetId || null, details ? JSON.stringify(details) : null);
}
```

Call this in every admin API route after performing an action.

---

## Environment Variables Required

```env
# Flux API
FLUX_API_KEY=your_flux_api_key

# Cloudflare R2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=study-app-images
R2_PUBLIC_URL=https://images.yourdomain.com
```

---

## Verification Steps

After implementation, verify:

1. **Admin guard**: Non-admin user navigating to `/admin` is redirected to `/library`
2. **Dashboard**: Stats display correctly, activity feed shows recent entries
3. **Users**: Table loads, search works, approve/ban/admin actions update correctly
4. **Waitlist**: Pending entries shown, approve generates `approval_token` + triggers Resend email, deny updates status
5. **Waitlist approval email**: Verify Resend sends warm email with registration link `/welcome/[token]`, link expires after 7 days
6. **Invite codes**: Table shows all invites across users — inviter, invitee, linked study, redemption status
7. **Gift codes**: Create code for specific user + format, verify it appears in table with correct `uses_remaining`, verify user can redeem and generate
8. **Gift code depletion**: After all uses consumed, code shows depleted status, user loses generation access for that format
9. **Studies**: Table loads, feature/unfeature toggles, delete with confirmation works
10. **Images — model selector**: Switch between Flux 2 Pro and Flux 2 Max, verify cost display updates ($0.05 vs $0.20)
11. **Images — preview workflow**: "Generate Previews" creates 2-3 variations side by side, admin selects one, only selected image uploads to R2
12. **Analytics**: All query sections display data (or empty states)
13. **Admin logging**: Every action creates an entry in `admin_actions` table
14. **Responsive**: Admin panel is usable on tablet (sidebar collapses or scrolls)

---

## Dependencies to Install

```bash
npm install @aws-sdk/client-s3
# Shadcn components needed:
npx shadcn@latest add table dialog alert-dialog select textarea badge tabs
```

---

## Notes

- The admin panel does not need to be beautiful — it needs to be functional and reliable.
- All admin API routes must check `is_admin` before processing.
- Image generation requires a valid Flux API key. If not configured, the image generation page should show a message: "Flux API key not configured."
- R2 requires an S3-compatible client. The `@aws-sdk/client-s3` package works with R2.
- For the MVP, analytics are simple tables. Charts can be added later with a library like recharts if desired.
