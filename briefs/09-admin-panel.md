# Brief 09: Admin Panel

**Recommended mode: Direct Execution**

> **Branch:** All work on `develop`. Commit when complete with message: `Brief 09: Admin panel — dashboard, gift codes, waitlist, users, studies, images`
> **Path note:** This project uses `app/` not `app/src/`.

---

## ⚠️ Pre-Implementation Notes (April 15, 2026)

**Runs after Brief 11.** Expects the image generation API routes and admin image page (`app/admin/images/page.tsx`) to already exist — 09 integrates the image section, doesn't build it.

**Auth pattern corrections:**
- **Do NOT** define a local `requireAdmin()` helper (Section "Helper: requireAdmin" near line 861). One already exists at `lib/auth/middleware.ts`:
  ```ts
  import { requireAdmin } from "@/lib/auth/middleware";
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  // auth.user.userId, auth.user.username, auth.user.isAdmin
  ```
- All route handlers shown with `getSession()?.user?.isAdmin` must be rewritten to use `requireAdmin()` from `@/lib/auth/middleware` (Section 1 CLAUDE.md rule).
- Import path `@/lib/auth` does not exist — use `@/lib/auth/middleware` or `@/lib/auth/session`.

**Already-implemented routes (do NOT recreate — integrate with existing):**
- `app/api/admin/waitlist/route.ts` and `app/api/admin/waitlist/[id]/route.ts` — waitlist approval (Brief 03)
- `app/api/invites/route.ts` — invite code creation (Brief 03)
- Annotation CRUD under `app/api/studies/[id]/annotations/*` (Brief 08a)
- Image generation routes under `app/api/admin/images/*` (Brief 11, preceding)

**Schema note:** The existing users table already has `is_admin`, `is_approved`, `is_banned` columns — verify before adding CREATE TABLE statements. Don't drop/recreate.

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
