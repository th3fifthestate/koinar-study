# /settings — Tabbed Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tabbed `/settings` surface (Profile, Account, API Key, Invitations, Admin) that replaces the `/profile` stub, with five API routes, a schema v9 migration, and full WAI-ARIA keyboard nav.

**Architecture:** Single `page.tsx` server component reads auth + data, passes typed props to a `use client` `SettingsShell` component. Tab state lives in the URL (`?tab=`). Five co-located tab components. Five API routes under `/api/user/`. Iron-session for auth everywhere.

**Tech Stack:** Next.js App Router, better-sqlite3, Vitest, Zod, argon2, iron-session, Tailwind CSS (Sage & Stone palette).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/db/schema.ts` | Modify | Bump `SCHEMA_VERSION` 8→9 |
| `app/lib/db/connection.ts` | Modify | Add v8→v9 migration block |
| `app/lib/db/types.ts` | Modify | Add `UserSettings`, `InviteRow` interfaces |
| `app/lib/db/queries.ts` | Modify | Add 7 new query helpers |
| `app/lib/db/queries.settings.test.ts` | Create | Vitest tests for new helpers (in-memory SQLite) |
| `app/app/(main)/profile/page.tsx` | Modify | Replace stub with `redirect("/settings")` |
| `app/app/(main)/settings/page.tsx` | Create | Server component: auth guard, fetch, tab routing |
| `app/app/(main)/settings/settings-shell.tsx` | Create | `use client`: WAI-ARIA tab nav + panel switcher |
| `app/app/(main)/settings/tabs/profile-tab.tsx` | Create | Display name + bio form |
| `app/app/(main)/settings/tabs/account-tab.tsx` | Create | Email (readonly) + change password form |
| `app/app/(main)/settings/tabs/api-key-tab.tsx` | Create | API key paste/delete + status + cost guidance |
| `app/app/(main)/settings/tabs/invitations-tab.tsx` | Create | Read-only invite table |
| `app/app/(main)/settings/tabs/admin-tab.tsx` | Create | Editorial card linking to /admin |
| `app/app/api/user/profile/route.ts` | Create | PATCH: display name + bio |
| `app/app/api/user/password/route.ts` | Create | PATCH: change password |
| `app/app/api/user/api-key/route.ts` | Create | PATCH + DELETE: store/clear Anthropic key |
| `app/app/api/user/invitations/route.ts` | Create | GET: caller's own invite list |
| `app/app/api/auth/api-key/route.ts` | **Delete** | Migrated to `/api/user/api-key` |

---

## Task 1: Schema v9 migration

**Files:**
- Modify: `app/lib/db/schema.ts`
- Modify: `app/lib/db/connection.ts`

- [ ] **Step 1: Bump SCHEMA_VERSION**

In `app/lib/db/schema.ts`, change line 3:

```ts
export const SCHEMA_VERSION = 9;
```

- [ ] **Step 2: Add v8→v9 migration block in `connection.ts`**

In `app/lib/db/connection.ts`, insert this block immediately before the `runStatements(database, CREATE_INDEXES)` call (around line 225):

```ts
    // v8 → v9: Settings surface — add api_key_tail and api_key_updated_at to users.
    if (currentVersion < 9) {
      for (const sql of [
        'ALTER TABLE users ADD COLUMN api_key_tail TEXT',
        'ALTER TABLE users ADD COLUMN api_key_updated_at TEXT',
      ]) {
        try { database.prepare(sql).run(); } catch { /* column already exists */ }
      }
    }
```

- [ ] **Step 3: Verify migration applies**

Start the dev server (`npm run dev`) and confirm it starts without error. The migration runs at startup. Then stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/lib/db/schema.ts app/lib/db/connection.ts
git commit -m "feat(db): schema v9 — add api_key_tail and api_key_updated_at to users"
```

---

## Task 2: DB types

**Files:**
- Modify: `app/lib/db/types.ts`

- [ ] **Step 1: Add `UserSettings` and `InviteRow` interfaces**

Open `app/lib/db/types.ts` and append at the bottom:

```ts
export interface UserSettings {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  hasApiKey: boolean;
  apiKeyTail: string | null;
  apiKeyUpdatedAt: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export interface InviteRow {
  code: string;
  inviteeName: string;
  inviteeEmail: string;
  // derived: used_by IS NOT NULL → 'accepted'; is_active = 0 → 'expired'; else 'pending'
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/db/types.ts
git commit -m "feat(db): add UserSettings and InviteRow types"
```

---

## Task 3: Query helpers — read side

**Files:**
- Modify: `app/lib/db/queries.ts`
- Create: `app/lib/db/queries.settings.test.ts`

- [ ] **Step 1: Add imports to `queries.ts`**

At the top of `app/lib/db/queries.ts`, extend the existing type imports:

```ts
import type {
  // ... existing imports ...
  UserSettings,
  InviteRow,
} from './types';
```

- [ ] **Step 2: Write the failing tests**

Create `app/lib/db/queries.settings.test.ts`. Note: tests use `db.prepare().run()` (better-sqlite3's parameterized API), not the multi-statement runner, to keep each setup step explicit and safe:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

function buildSchema(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      api_key_encrypted TEXT,
      api_key_tail TEXT,
      api_key_updated_at TEXT,
      invited_by INTEGER,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT,
      avatar_url TEXT
    )
  `).run();
  db.prepare(`
    CREATE TABLE invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      invitee_name TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      linked_study_id INTEGER,
      used_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `).run();
}

function seedUsers(db: Database.Database): void {
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, bio, is_admin)
    VALUES (1, 'alice', 'alice@example.com', 'hash', 'Alice', 'Hello', 0)
  `).run();
}

function seedInvites(db: Database.Database): void {
  // CODE1: pending (unused, active)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE1', 1, 'Bob', 'bob@example.com', NULL, 1)`
  ).run();
  // CODE2: accepted (used_by is set)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE2', 1, 'Carol', 'carol@example.com', 2, 0)`
  ).run();
  // CODE3: expired (not used, not active)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE3', 1, 'Dan', 'dan@example.com', NULL, 0)`
  ).run();
}

describe('getUserSettings SQL shape', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    buildSchema(db);
    seedUsers(db);
  });

  afterEach(() => db.close());

  it('returns the row for an existing user', () => {
    const row = db.prepare(`
      SELECT id, username, email, display_name, bio,
        api_key_encrypted IS NOT NULL AS has_api_key,
        api_key_tail, api_key_updated_at, created_at, is_admin
      FROM users WHERE id = ?
    `).get(1) as Record<string, unknown>;

    expect(row.username).toBe('alice');
    expect(row.display_name).toBe('Alice');
    expect(row.has_api_key).toBe(0);
    expect(row.is_admin).toBe(0);
  });

  it('returns undefined for an unknown user', () => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(999);
    expect(row).toBeUndefined();
  });

  it('reflects has_api_key=1 when encrypted key is stored', () => {
    db.prepare('UPDATE users SET api_key_encrypted = ? WHERE id = ?').run('encrypted-value', 1);
    const row = db.prepare(
      `SELECT api_key_encrypted IS NOT NULL AS has_api_key FROM users WHERE id = ?`
    ).get(1) as { has_api_key: number };
    expect(row.has_api_key).toBe(1);
  });
});

describe('listUserInvitations status derivation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    buildSchema(db);
    seedUsers(db);
    seedInvites(db);
  });

  afterEach(() => db.close());

  it('derives status correctly for all three cases', () => {
    const rows = db.prepare(`
      SELECT code,
        CASE
          WHEN used_by IS NOT NULL THEN 'accepted'
          WHEN is_active = 0 THEN 'expired'
          ELSE 'pending'
        END AS status
      FROM invite_codes WHERE created_by = ? ORDER BY id
    `).all(1) as Array<{ code: string; status: string }>;

    const byCode = Object.fromEntries(rows.map(r => [r.code, r.status]));
    expect(byCode['CODE1']).toBe('pending');
    expect(byCode['CODE2']).toBe('accepted');
    expect(byCode['CODE3']).toBe('expired');
  });

  it('does not return invites belonging to another user', () => {
    const rows = db.prepare(`SELECT * FROM invite_codes WHERE created_by = ?`).all(999);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests — confirm they pass**

```bash
cd app && npx vitest run lib/db/queries.settings.test.ts
```

Expected: all tests pass (they verify the SQL logic that the helpers will use).

- [ ] **Step 4: Add `getUserSettings`, `getUserForAuthById`, and `listUserInvitations` to `queries.ts`**

Append to the user queries section of `app/lib/db/queries.ts`:

```ts
export function getUserSettings(userId: number): UserSettings | null {
  const row = getDb()
    .prepare(`
      SELECT
        id, username, email, display_name, bio,
        api_key_encrypted IS NOT NULL AS has_api_key,
        api_key_tail, api_key_updated_at, created_at, is_admin
      FROM users WHERE id = ?
    `)
    .get(userId) as {
      id: number; username: string; email: string;
      display_name: string | null; bio: string | null;
      has_api_key: number; api_key_tail: string | null;
      api_key_updated_at: string | null; created_at: string; is_admin: number;
    } | undefined;

  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    hasApiKey: row.has_api_key === 1,
    apiKeyTail: row.api_key_tail,
    apiKeyUpdatedAt: row.api_key_updated_at,
    createdAt: row.created_at,
    isAdmin: row.is_admin === 1,
  };
}

/** Returns full User row by id, for password-change flow only. Never expose to API responses. */
export function getUserForAuthById(userId: number): User | null {
  return (
    (getDb()
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as User | undefined) ?? null
  );
}

export function listUserInvitations(userId: number): InviteRow[] {
  const rows = getDb()
    .prepare(`
      SELECT
        code, invitee_name, invitee_email,
        CASE
          WHEN used_by IS NOT NULL THEN 'accepted'
          WHEN is_active = 0 THEN 'expired'
          ELSE 'pending'
        END AS status,
        created_at
      FROM invite_codes
      WHERE created_by = ?
      ORDER BY created_at DESC
    `)
    .all(userId) as Array<{
      code: string; invitee_name: string; invitee_email: string;
      status: 'pending' | 'accepted' | 'expired'; created_at: string;
    }>;

  return rows.map(r => ({
    code: r.code,
    inviteeName: r.invitee_name,
    inviteeEmail: r.invitee_email,
    status: r.status,
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 5: Run typecheck**

```bash
cd app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/lib/db/queries.ts app/lib/db/queries.settings.test.ts
git commit -m "feat(db): add getUserSettings, getUserForAuthById, listUserInvitations"
```

---

## Task 4: Query helpers — write side

**Files:**
- Modify: `app/lib/db/queries.ts`

- [ ] **Step 1: Append write helpers**

```ts
export function updateUserProfile(
  userId: number,
  opts: { displayName: string; bio: string | null }
): void {
  getDb()
    .prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?')
    .run(opts.displayName, opts.bio, userId);
}

export function updateUserPassword(userId: number, newHash: string): void {
  getDb()
    .prepare(
      'UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?'
    )
    .run(newHash, userId);
}

export function setUserApiKey(userId: number, encrypted: string, tail: string): void {
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      'UPDATE users SET api_key_encrypted = ?, api_key_tail = ?, api_key_updated_at = ? WHERE id = ?'
    )
    .run(encrypted, tail, updatedAt, userId);
}

export function clearUserApiKey(userId: number): void {
  getDb()
    .prepare(
      'UPDATE users SET api_key_encrypted = NULL, api_key_tail = NULL, api_key_updated_at = NULL WHERE id = ?'
    )
    .run(userId);
}
```

- [ ] **Step 2: Run typecheck + tests**

```bash
cd app && npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/lib/db/queries.ts
git commit -m "feat(db): add updateUserProfile, updateUserPassword, setUserApiKey, clearUserApiKey"
```

---

## Task 5: API route — PATCH /api/user/profile

**Files:**
- Create: `app/app/api/user/profile/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { updateUserProfile } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

const schema = z.object({
  displayName: z.string().min(1).max(80),
  bio: z.string().max(280).default(''),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { displayName, bio } = parsed.data;
  updateUserProfile(auth.user.userId, {
    displayName,
    bio: bio === '' ? null : bio,
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/app/api/user/profile/route.ts
git commit -m "feat(api): PATCH /api/user/profile — display name and bio update"
```

---

## Task 6: API route — PATCH /api/user/password

**Files:**
- Create: `app/app/api/user/password/route.ts`

- [ ] **Step 1: Create the route**

Note on session invalidation: `deleteUserSessions` clears the DB `sessions` table; `session.destroy()` invalidates the iron-session cookie. Both run together. The client then redirects to `/login` — this is UX polish on top of the server-side invalidation.

```ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getUserForAuthById, updateUserPassword, deleteUserSessions } from '@/lib/db/queries';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

// 3 per 10 minutes per user — matches brief rate-limit spec
const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });

// min(8) mirrors register/route.ts Zod schema exactly — keep in sync if register changes
const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const userRow = getUserForAuthById(auth.user.userId);
  if (!userRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await verifyPassword(userRow.password_hash, currentPassword);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  updateUserPassword(auth.user.userId, newHash);

  // Belt-and-suspenders: invalidate DB sessions table + destroy iron-session cookie
  deleteUserSessions(auth.user.userId);
  const session = await getSession();
  await session.destroy();

  console.info(`[security] password changed for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/app/api/user/password/route.ts
git commit -m "feat(api): PATCH /api/user/password — argon2 verify, session destroy + DB invalidation"
```

---

## Task 7: API route — PATCH + DELETE /api/user/api-key (migrate)

**Files:**
- Create: `app/app/api/user/api-key/route.ts`
- Delete: `app/app/api/auth/api-key/route.ts`

- [ ] **Step 1: Create the new route**

Note: PATCH and DELETE share one rate-limit bucket — both are key-state mutations and should consume the same per-user budget.

```ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { encryptApiKey } from '@/lib/ai/keys';
import { setUserApiKey, clearUserApiKey } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

// Shared bucket: PATCH + DELETE are both key-state mutations
const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });

const setKeySchema = z.object({
  apiKey: z.string().min(1),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = setKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'apiKey field required' }, { status: 400 });
  }

  if (!parsed.data.apiKey.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: "Invalid API key format. Anthropic keys start with 'sk-ant-'" },
      { status: 400 }
    );
  }

  // Extract tail from plaintext BEFORE encryption — never from ciphertext
  const tail = parsed.data.apiKey.slice(-4);
  const encrypted = encryptApiKey(parsed.data.apiKey);
  setUserApiKey(auth.user.userId, encrypted, tail);

  console.info(`[security] api key updated for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429 }
    );
  }

  clearUserApiKey(auth.user.userId);
  console.info(`[security] api key cleared for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Delete the old route file**

```bash
rm app/app/api/auth/api-key/route.ts
rmdir app/app/api/auth/api-key 2>/dev/null || true
```

Verify no callers remain:

```bash
grep -r "api/auth/api-key" app/app --include="*.ts" --include="*.tsx"
```

Expected: no output (zero callers existed).

- [ ] **Step 3: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/app/api/user/api-key/route.ts
git rm app/app/api/auth/api-key/route.ts
git commit -m "feat(api): migrate api-key route POST→PATCH to /api/user/api-key; delete old /api/auth/api-key"
```

---

## Task 8: API route — GET /api/user/invitations

**Files:**
- Create: `app/app/api/user/invitations/route.ts`

Note: the Settings UI fetches invitations server-side (prop from `page.tsx`). This route exists for API completeness per the brief spec, but is not called by the tab component.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { listUserInvitations } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const invitations = listUserInvitations(auth.user.userId);
  return NextResponse.json({ invitations });
}
```

- [ ] **Step 2: Run typecheck + tests**

```bash
cd app && npm run typecheck && npm test
```

Expected: no errors, all passing.

- [ ] **Step 3: Commit**

```bash
git add app/app/api/user/invitations/route.ts
git commit -m "feat(api): GET /api/user/invitations — caller's own invite list"
```

---

## Task 9: /profile redirect

**Files:**
- Modify: `app/app/(main)/profile/page.tsx`

- [ ] **Step 1: Replace stub with redirect**

```tsx
// Redirect preserves legacy /profile links; canonical URL is /settings since Brief 20.
import { redirect } from "next/navigation";
export default function ProfileRedirect() {
  redirect("/settings");
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/app/(main)/profile/page.tsx"
git commit -m "feat(routing): /profile → redirect to /settings (legacy link preservation)"
```

---

## Task 10: Settings page.tsx

**Files:**
- Create: `app/app/(main)/settings/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserSettings, listUserInvitations } from "@/lib/db/queries";
import { SettingsShell } from "./settings-shell";

export const metadata = { title: "Settings — Koinar" };

const VALID_TABS = ["profile", "account", "api-key", "invitations", "admin"] as const;
type TabId = typeof VALID_TABS[number];

function resolveTab(raw: string | undefined, isAdmin: boolean): TabId {
  const t = (raw ?? "profile") as TabId;
  if (!VALID_TABS.includes(t)) return "profile";
  if (t === "admin" && !isAdmin) return "profile";
  return t;
}

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  if (!user.isApproved) redirect("/pending");

  const settings = getUserSettings(user.userId);
  if (!settings) redirect("/login");

  const invitations = listUserInvitations(user.userId);
  const sp = await props.searchParams;

  // Non-admin attempting ?tab=admin → silent redirect server-side (before shell sees it)
  if (sp.tab === "admin" && !user.isAdmin) {
    redirect("/settings?tab=profile");
  }

  const initialTab = resolveTab(sp.tab, user.isAdmin);

  return (
    <SettingsShell
      user={user}
      settings={settings}
      invitations={invitations}
      initialTab={initialTab}
    />
  );
}
```

- [ ] **Step 2: Run typecheck** (will complain about missing `SettingsShell` until Task 11 — expected)

- [ ] **Step 3: Commit**

```bash
git add "app/app/(main)/settings/page.tsx"
git commit -m "feat(settings): page.tsx — auth guard, server data fetch, tab routing, admin redirect"
```

---

## Task 11: SettingsShell component

**Files:**
- Create: `app/app/(main)/settings/settings-shell.tsx`

- [ ] **Step 1: Create the shell**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import type { SessionData } from '@/lib/auth/session';
import type { UserSettings, InviteRow } from '@/lib/db/types';
import { ProfileTab } from './tabs/profile-tab';
import { AccountTab } from './tabs/account-tab';
import { ApiKeyTab } from './tabs/api-key-tab';
import { InvitationsTab } from './tabs/invitations-tab';
import { AdminTab } from './tabs/admin-tab';

type TabId = 'profile' | 'account' | 'api-key' | 'invitations' | 'admin';
interface Tab { id: TabId; label: string; }

const BASE_TABS: Tab[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'api-key', label: 'API Key' },
  { id: 'invitations', label: 'Invitations' },
];

interface Props {
  user: SessionData;
  settings: UserSettings;
  invitations: InviteRow[];
  initialTab: string;
}

export function SettingsShell({ user, settings, invitations, initialTab }: Props) {
  const router = useRouter();
  const tabs = user.isAdmin
    ? [...BASE_TABS, { id: 'admin' as TabId, label: 'Admin' }]
    : BASE_TABS;
  const activeTab = (tabs.find(t => t.id === initialTab)?.id ?? 'profile') as TabId;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function switchTab(id: TabId) {
    router.push(`/settings?tab=${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = tabs.length - 1;
    }
    if (next !== null) {
      e.preventDefault();
      tabRefs.current[next]?.focus();
      switchTab(tabs[next].id);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <h1 className="font-display text-3xl md:text-4xl font-normal text-stone-900 mb-10">
          Settings
        </h1>
        <div className="md:flex md:gap-12">
          {/* Tab nav — left-rail on desktop, horizontal pills on mobile */}
          <nav
            role="tablist"
            aria-label="Settings sections"
            className="flex md:flex-col gap-1 md:gap-0 md:w-44 mb-8 md:mb-0 flex-shrink-0 overflow-x-auto md:overflow-visible"
          >
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={el => { tabRefs.current[i] = el; }}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => switchTab(tab.id)}
                onKeyDown={e => handleKeyDown(e, i)}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={[
                  'font-body text-base text-left px-3 py-2 transition-colors whitespace-nowrap',
                  'md:border-l-2',
                  activeTab === tab.id
                    ? 'md:border-sage-500 text-stone-900 font-medium underline md:no-underline underline-offset-2'
                    : 'md:border-transparent text-stone-500 hover:text-stone-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Active tab panel */}
          <div className="flex-1 min-w-0">
            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'profile' && <ProfileTab settings={settings} />}
              {activeTab === 'account' && <AccountTab settings={settings} />}
              {activeTab === 'api-key' && <ApiKeyTab settings={settings} />}
              {activeTab === 'invitations' && <InvitationsTab invitations={invitations} />}
              {activeTab === 'admin' && user.isAdmin && <AdminTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck** (will complain about missing tab imports — expected until Tasks 12–15)

- [ ] **Step 3: Commit**

```bash
git add "app/app/(main)/settings/settings-shell.tsx"
git commit -m "feat(settings): SettingsShell — WAI-ARIA tabs, keyboard nav, URL-synced state"
```

---

## Task 12: Profile tab

**Files:**
- Create: `app/app/(main)/settings/tabs/profile-tab.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useRef } from 'react';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function ProfileTab({ settings }: Props) {
  const [displayName, setDisplayName] = useState(settings.displayName ?? '');
  const [bio, setBio] = useState(settings.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save');
      }
      setStatus('saved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="displayName" className="block font-body text-base text-stone-700 mb-1">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          maxLength={80}
          required
          className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block font-body text-base text-stone-700 mb-1">
          Bio{' '}
          <span className="text-stone-400 text-sm">(optional)</span>
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={280}
          rows={4}
          className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500 resize-none"
        />
        <p className="mt-1 font-body text-sm text-stone-400" aria-live="polite">
          {bio.length}/280
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && (
          <span className="font-body text-base text-stone-500" aria-live="polite">Saved.</span>
        )}
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add "app/app/(main)/settings/tabs/profile-tab.tsx"
git commit -m "feat(settings): Profile tab — display name, bio, live char counter"
```

---

## Task 13: Account tab

**Files:**
- Create: `app/app/(main)/settings/tabs/account-tab.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function AccountTab({ settings }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to update password');
      }
      // Session destroyed server-side; client redirect is UX polish on top
      router.push('/login?message=password-updated');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-10 max-w-lg">
      <div>
        <p className="font-body text-base text-stone-500 mb-1">Email</p>
        <p className="font-body text-base text-stone-900">{settings.email}</p>
        <p className="mt-1 font-body text-sm text-stone-400">
          Email changes are not yet supported.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="font-display text-xl font-normal text-stone-900">Change password</h2>

        <div>
          <label htmlFor="currentPassword" className="block font-body text-base text-stone-700 mb-1">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block font-body text-base text-stone-700 mb-1">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            aria-describedby={error ? 'password-error' : undefined}
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block font-body text-base text-stone-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'saving'}
          className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
        >
          {status === 'saving' ? 'Updating…' : 'Update password'}
        </button>

        {error && (
          <p
            id="password-error"
            role="alert"
            aria-live="assertive"
            className="font-body text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add "app/app/(main)/settings/tabs/account-tab.tsx"
git commit -m "feat(settings): Account tab — email display, change password with client validation"
```

---

## Task 14: API Key tab

**Files:**
- Create: `app/app/(main)/settings/tabs/api-key-tab.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function ApiKeyTab({ settings }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(settings.hasApiKey);
  const [keyTail, setKeyTail] = useState(settings.apiKeyTail);
  const [keyUpdatedAt, setKeyUpdatedAt] = useState(settings.apiKeyUpdatedAt);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset armed state after 4s of inactivity (safety — prevents accidental delete by a bystander)
  useEffect(() => {
    if (!deleteArmed) return;
    armTimerRef.current = setTimeout(() => setDeleteArmed(false), 4000);
    return () => { if (armTimerRef.current) clearTimeout(armTimerRef.current); };
  }, [deleteArmed]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save key');
      }
      setHasKey(true);
      setKeyTail(apiKey.slice(-4));
      setKeyUpdatedAt(new Date().toISOString());
      setApiKey('');
      setSaveStatus('saved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    // Second click — confirmed
    setDeleteArmed(false);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    setDeleteStatus('deleting');
    setDeleteError(null);
    try {
      const res = await fetch('/api/user/api-key', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to delete key');
      }
      setHasKey(false);
      setKeyTail(null);
      setKeyUpdatedAt(null);
      setDeleteStatus('idle');
    } catch (err) {
      setDeleteStatus('error');
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="font-display text-xl font-normal text-stone-900 mb-4">
          Anthropic API key
        </h2>

        {hasKey && keyTail && (
          <div className="mb-4 p-3 bg-stone-100 rounded font-body text-base text-stone-700">
            Key on file — ends in{' '}
            <span className="font-mono">…{keyTail}</span>
            {keyUpdatedAt && (
              <span className="text-stone-500">
                {', last updated '}
                {new Date(keyUpdatedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block font-body text-base text-stone-700 mb-1">
              {hasKey ? 'Replace key' : 'Paste your key'}
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base font-mono text-stone-900 focus:outline-none focus:border-sage-500"
            />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={!apiKey || saveStatus === 'saving'}
              className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save key'}
            </button>

            {saveStatus === 'saved' && (
              <span className="font-body text-base text-stone-500" aria-live="polite">
                Saved.
              </span>
            )}

            {hasKey && (
              <button
                type="button"
                onClick={handleDelete}
                onBlur={() => { setDeleteArmed(false); }}
                disabled={deleteStatus === 'deleting'}
                className="font-body text-base text-red-600 underline underline-offset-2 hover:text-red-800 transition-colors disabled:opacity-50"
              >
                {deleteArmed ? 'Are you sure? Click to confirm' : 'Delete key'}
              </button>
            )}
          </div>

          {saveError && (
            <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
              {saveError}
            </p>
          )}
          {deleteError && (
            <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </form>
      </div>

      {/* Cost guidance — editorial tone, not a warning box */}
      <div className="border-t border-stone-200 pt-6">
        <p className="font-body text-base leading-relaxed text-stone-600">
          Koinar uses your Anthropic account to write studies. A standard study costs roughly
          $0.30 – $0.60 depending on length and model. Comprehensive studies may run up
          to ~$1.50. You'll see the exact cost after each generation.
        </p>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors"
        >
          Get a key from the Anthropic console →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add "app/app/(main)/settings/tabs/api-key-tab.tsx"
git commit -m "feat(settings): API Key tab — paste/replace, two-step delete (4s reset + blur), cost guidance"
```

---

## Task 15: Invitations tab + Admin tab

**Files:**
- Create: `app/app/(main)/settings/tabs/invitations-tab.tsx`
- Create: `app/app/(main)/settings/tabs/admin-tab.tsx`

- [ ] **Step 1: Create Invitations tab**

```tsx
import type { InviteRow } from '@/lib/db/types';

interface Props { invitations: InviteRow[]; }

const STATUS_LABELS: Record<InviteRow['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
};

export function InvitationsTab({ invitations }: Props) {
  if (invitations.length === 0) {
    return (
      <p className="font-body text-base text-stone-500">
        You haven't issued any invitations yet.{' '}
        <a
          href="/onboarding"
          className="text-sage-700 underline underline-offset-2 hover:text-sage-900"
        >
          Issue an invitation
        </a>
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-body text-base text-stone-700">
        <thead>
          <tr className="border-b border-stone-200 text-left">
            <th className="pb-2 font-medium text-stone-900 pr-6">Code</th>
            <th className="pb-2 font-medium text-stone-900 pr-6">Recipient</th>
            <th className="pb-2 font-medium text-stone-900 pr-6">Status</th>
            <th className="pb-2 font-medium text-stone-900">Issued</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map(inv => (
            <tr key={inv.code} className="border-b border-stone-100">
              <td className="py-3 pr-6 font-mono text-sm text-stone-600">{inv.code}</td>
              <td className="py-3 pr-6">
                <span className="block">{inv.inviteeName}</span>
                <span className="block text-sm text-stone-400">{inv.inviteeEmail}</span>
              </td>
              <td className="py-3 pr-6">
                <span
                  className={
                    inv.status === 'accepted'
                      ? 'text-sage-700'
                      : inv.status === 'expired'
                        ? 'text-stone-400'
                        : 'text-stone-600'
                  }
                >
                  {STATUS_LABELS[inv.status]}
                </span>
              </td>
              <td className="py-3 text-sm text-stone-500">
                {new Date(inv.createdAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Note: the empty-state link points to `/onboarding` as the invite entry point (per Brief 04). Verify the correct path in the codebase — update `href` if the invite flow lives elsewhere.

- [ ] **Step 2: Create Admin tab**

```tsx
import Link from 'next/link';

export function AdminTab() {
  return (
    <div className="border-t border-stone-200 pt-10">
      <span className="font-body text-[0.7rem] uppercase tracking-[0.3em] text-stone-400">
        Admin
      </span>
      <h2 className="mt-4 font-display text-2xl md:text-3xl font-normal text-stone-900">
        The Admin panel.
      </h2>
      <p className="mt-4 font-body text-base leading-relaxed text-stone-600 max-w-xl">
        Manage studies, gift codes, waitlist approvals, users, and image generation.
        The panel has its own navigation and audit log.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors"
      >
        Open the Admin panel →
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck + full tests**

```bash
cd app && npm run typecheck && npm test
```

Expected: no errors, all tests passing.

- [ ] **Step 4: Commit**

```bash
git add "app/app/(main)/settings/tabs/invitations-tab.tsx" "app/app/(main)/settings/tabs/admin-tab.tsx"
git commit -m "feat(settings): Invitations tab (read-only table) and Admin tab (server-gated link)"
```

---

## Task 16: End-to-end verification

- [ ] **Step 1: Final lint + typecheck + tests**

```bash
cd app && npm run lint && npm run typecheck && npm test
```

Expected: all green.

- [ ] **Step 2: Start dev server and verify manually**

```bash
npm run dev
```

Work through the checklist. Each item must pass before proceeding:

- [ ] `GET /profile` redirects to `/settings`
- [ ] `/settings` (no query) shows Profile tab with display name + bio fields
- [ ] `?tab=account` shows Account tab; email shown as text, not an input
- [ ] `?tab=api-key` shows API Key tab; no status line when no key stored
- [ ] `?tab=invitations` shows Invitations tab (empty state or table)
- [ ] `?tab=admin` as non-admin → server redirect to `?tab=profile` (check URL in browser)
- [ ] `?tab=admin` as admin → Admin card with "Open the Admin panel →" link
- [ ] Non-admin: exactly 4 tabs in the nav. Admin: 5 tabs.
- [ ] Profile: change display name → save → hard refresh → value persists
- [ ] Account: wrong current password → inline error (no page reload)
- [ ] Account: correct password → redirect to `/login`
- [ ] API Key: paste `sk-ant-api03testkey1234` → save → status shows "ends in `1234`"
- [ ] API Key: click Delete → button reads "Are you sure? Click to confirm"
- [ ] API Key: wait 4s → button resets to "Delete key"
- [ ] API Key: click Delete → click confirm → status line disappears
- [ ] Keyboard: Tab to tablist → Left/Right switches tabs → Home/End jump to first/last
- [ ] Tab key from last tablist button moves focus into panel content (not cycling tabs)
- [ ] Active tab has `aria-selected="true"` (verify in DevTools Elements panel)
- [ ] All inputs have a visible `<label>` pointing to them (verify with DevTools)
- [ ] Body text is 16px throughout (verify with DevTools Computed styles)
- [ ] Footer "Settings" link (Brief 16) navigates to `/settings`

- [ ] **Step 3: Commit with security self-review in body**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
Brief 20: /settings — tabbed surface (profile, account, API key, admin link)

New /settings surface with 5 tabs (Profile, Account, API Key, Invitations, Admin).
/profile redirects to /settings (legacy link preservation).
Admin tab is server-gated — hidden entirely from non-admins, not CSS-hidden.
Non-admin hitting ?tab=admin → server redirect to ?tab=profile.

API routes:
- PATCH /api/user/profile         (display name, bio; ""→null coercion in route)
- PATCH /api/user/password        (argon2 verify; session.destroy() + deleteUserSessions)
- PATCH /api/user/api-key         (encrypt; tail=apiKey.slice(-4) from plaintext)
- DELETE /api/user/api-key        (clear)
- GET    /api/user/invitations    (API route exists; UI uses server-fetch prop instead)
PATCH+DELETE api-key share one rate-limit bucket (both are key-state mutations).
Old /api/auth/api-key deleted — zero callers existed outside its own file.

Schema v9: api_key_tail + api_key_updated_at columns added to users.

Password validation: min(8) — mirrors register/route.ts Zod schema exactly.

Security self-review:
- Trust boundaries: client→server over HTTPS; server encrypts keys, hashes passwords
- Caller assumptions: userId always from session, never request body
- Abuse vectors: IDOR (blocked by session-scoped queries), key exfil (no full-key
  GET; tail extracted from plaintext before encryption), brute force (3/10min rate
  limit + currentPassword required for change)
- Audit: console.info for password change and api-key mutations; admin_actions not
  used (that table is for admin-on-user actions); user_security_events deferred
EOF
)"
```

---

## Self-Review Notes

- **Password min(8) vs brief's min(10):** Brief specified 10; register uses 8. Plan uses 8 to match register. If register ever tightens, update both simultaneously.
- **Empty-state invite link:** Points to `/onboarding` — implementor must verify this is the correct invite-issuance URL in this codebase.
- **`InvitationsTab` is not a Client Component:** It receives a plain `InviteRow[]` prop and renders a table — no state needed. No `'use client'` directive required.
- **`session.destroy()` in Route Handler:** Iron-session's `session.destroy()` clears the encrypted cookie in the response. This works correctly in Next.js Route Handlers (PATCH/DELETE handlers have mutable cookie access).
