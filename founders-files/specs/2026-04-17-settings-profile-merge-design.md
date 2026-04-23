# Brief 20: /settings — Tabbed Surface Design

**Date:** 2026-04-17
**Branch:** develop
**Status:** Approved — ready for implementation plan

---

## Context

`/profile` is a stub. This brief ships a single tabbed `/settings` surface merging profile and settings, with a conditional Admin entry for admins. `/profile` redirects to `/settings` for legacy link preservation.

### Open decisions resolved during brainstorming

- **API key metadata storage:** Schema v9 migration (new `api_key_tail` + `api_key_updated_at` columns on `users`) — not JSON-in-blob. Cleaner to query; avoids decrypt-just-to-display.
- **Existing `/api/auth/api-key`:** Migrate to `/api/user/api-key` (POST→PATCH), delete old file. Zero callers outside the route file itself.
- **Non-admin hitting `?tab=admin`:** Server redirect to `?tab=profile` in `page.tsx` before props reach the shell.
- **Password session invalidation:** Delete all sessions including current → client redirects to `/login?message=password-updated`. Belt-and-suspenders: session is dead server-side regardless; redirect is UX polish.
- **Audit logging:** Skip in this brief. `admin_actions` is for admin-on-user actions; logging self-service writes there pollutes the admin stream. `console.info` only. `user_security_events` table deferred to a later brief.

---

## 1. Routing & File Structure

### New files

```
app/app/(main)/settings/
├── page.tsx                 # server component — auth guard, user fetch, tab routing
├── settings-shell.tsx       # 'use client' — tab nav + content switching
└── tabs/
    ├── profile-tab.tsx
    ├── account-tab.tsx
    ├── api-key-tab.tsx
    ├── invitations-tab.tsx
    └── admin-tab.tsx

app/app/api/user/
├── profile/route.ts         # PATCH — display name, bio
├── password/route.ts        # PATCH — change password
├── api-key/route.ts         # PATCH + DELETE (migrated from /api/auth/api-key)
└── invitations/route.ts     # GET — caller's own invite list
```

### Modified files

| File | Change |
|------|--------|
| `app/app/(main)/profile/page.tsx` | Replace with `redirect("/settings")` |
| `app/app/api/auth/api-key/route.ts` | **Delete** — migrated to `/api/user/api-key` |
| `app/lib/db/queries.ts` | Add 6 new query helpers |
| `app/lib/db/schema.ts` | Bump `SCHEMA_VERSION` to 9; add migration SQL |

### Auth guard in `page.tsx`

No `(main)` layout guard exists. Inline guard:

```ts
const user = await getCurrentUser();
if (!user) redirect("/login?next=/settings");
if (!user.isApproved) redirect("/pending");
```

Non-admin hitting `?tab=admin`: server detects `!user.isAdmin && tab === "admin"` and calls `redirect("/settings?tab=profile")` before passing props to the shell.

### Tab routing

URL query param: `?tab=profile|account|api-key|invitations|admin`. Default: `?tab=profile`. `page.tsx` reads `searchParams.tab`, resolves the active tab server-side, and passes `initialTab` to `SettingsShell`. Tab switches in the client push to the URL via `router.push`.

---

## 2. Data Layer

### Schema v9 migration

Two new columns on `users`:

```sql
ALTER TABLE users ADD COLUMN api_key_tail TEXT;
ALTER TABLE users ADD COLUMN api_key_updated_at TEXT;
INSERT INTO schema_migrations (version) VALUES (9);
```

`SCHEMA_VERSION` in `schema.ts` bumped from 8 to 9. Migration applies idempotently at startup via the existing migration runner.

### Query helpers (added to `queries.ts`)

```ts
interface UserSettings {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  hasApiKey: boolean;        // derived: api_key_encrypted IS NOT NULL
  apiKeyTail: string | null; // last 4 plaintext chars, stored at write time
  apiKeyUpdatedAt: string | null;
  createdAt: string;
  isAdmin: boolean;
}

interface InviteRow {
  code: string;
  inviteeName: string;
  inviteeEmail: string;
  // derived: used_by IS NOT NULL → 'accepted'; is_active = 0 → 'expired'; else 'pending'
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

getUserSettings(userId: number): UserSettings | null
updateUserProfile(userId: number, opts: { displayName: string; bio: string | null }): void
updateUserPassword(userId: number, newHash: string): void
setUserApiKey(userId: number, encrypted: string, tail: string): void  // derives updatedAt = new Date().toISOString() internally
clearUserApiKey(userId: number): void
listUserInvitations(userId: number): InviteRow[]
```

`getUserSettings` selects only safe columns — no `password_hash`, no `api_key_encrypted`. `hasApiKey` is a derived boolean. `setUserApiKey` derives `updatedAt` internally — callers never pass a timestamp.

---

## 3. API Routes

All under `app/app/api/user/`. Every route handler:

1. `const auth = await requireAuth(); if (auth.response) return auth.response;` — first line
2. Zod body validation
3. Parameterized SQL via query helper
4. Narrow response shape — never echo a full `users` row

### Rate limits (keyed on `user-${userId}`, not IP)

| Route | Limit |
|-------|-------|
| `PATCH /api/user/password` | 3 per 10 min |
| `PATCH /api/user/api-key` | 3 per 10 min (shared bucket with DELETE) |
| `DELETE /api/user/api-key` | shared bucket with PATCH |
| `GET /api/user/invitations` | 30 per min (API route exists; UI uses server-fetch — see §4) |
| `PATCH /api/user/profile` | 10 per min |

The shared PATCH+DELETE bucket for api-key is intentional — both are key-state mutations and should consume the same budget.

### `PATCH /api/user/profile`

Body: `{ displayName: string, bio: string }`  
Validation: `displayName` 1–80 chars, `bio` 0–280 chars.  
Bio coercion: route handler converts `bio === ""` → `null` before calling `updateUserProfile`. The query helper signature accepts `string | null`; the route is the coercion boundary.  
Calls `updateUserProfile`.  
Response: `{ success: true }`

### `PATCH /api/user/password`

Body: `{ currentPassword: string, newPassword: string }`  
Validation: `newPassword` ≥ 8 chars — mirrors `register/route.ts` Zod schema exactly (`z.string().min(8)`). Do not re-derive; if register tightens its rules, update both.  
Server: fetch full user row (`getUserForAuth`), `bcrypt.compare(currentPassword, user.password_hash)` — return 400 on mismatch.  
On success: `updateUserPassword` + `deleteUserSessions(userId)` in a transaction.  
Response: `{ success: true }` — client handles redirect to `/login?message=password-updated`.  
Security note: session is dead server-side regardless; client redirect is UX polish.  
Audit: `console.info` only — no `admin_actions` entry.

### `PATCH /api/user/api-key`

Body: `{ apiKey: string }`  
Validation: must start with `sk-ant-`.  
**Tail extraction:** `const tail = apiKey.slice(-4)` on the plaintext, before `encryptApiKey` is called. Never derive from ciphertext.  
Calls `setUserApiKey(userId, encryptApiKey(apiKey), tail)`.  
Response: `{ success: true }`  
Audit: `console.info` only.

### `DELETE /api/user/api-key`

No body.  
Calls `clearUserApiKey(userId)`.  
Response: `{ success: true }`

### `GET /api/user/invitations`

No body.  
Calls `listUserInvitations(userId)`.  
Response: `{ invitations: InviteRow[] }`  
Never returns another user's invitations — query always scoped to session `userId`.

---

## 4. UI Components

### `SettingsShell` (`use client`)

Receives: `user: SessionData`, `settings: UserSettings`, `invitations: InviteRow[]`, `initialTab: string`.

Tab nav: left-rail on `md:` and up, horizontal pills on mobile. Hand-rolled — no shadcn `<Tabs>`. Active tab read from `initialTab` prop; switches push to URL via `router.push("/settings?tab=…")`.

**WAI-ARIA Tabs pattern:**

```
role="tablist" on the nav container
role="tab" + aria-selected + aria-controls={panelId} on each nav button
role="tabpanel" + id={panelId} on the active content region
```

**Keyboard behavior:** Left/Right arrows switch tab; Home/End jump to first/last; Tab (keyboard) exits tablist and moves into panel content.

**Styling:**
- Desktop active: `border-l-2 border-sage-500 text-stone-900 font-medium`
- Desktop inactive: `text-stone-500`
- Mobile active: `font-medium underline underline-offset-2`
- Body: `font-body text-base` (16px) throughout

**Tab visibility:** Admin tab is only passed to the shell if `user.isAdmin`. The shell renders exactly what it receives — it has no admin-check logic of its own.

### Error handling (all tabs)

Every form has an error slot below the submit button:

```tsx
{error && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-600">{error}</p>}
```

Field-level errors reference the slot via `aria-describedby`. Server errors map to user-facing copy — never expose raw messages.

### Success feedback

Inline "Saved." microcopy fades after 3s (`setTimeout` clears the success state).

### Profile tab

- `displayName`: `<input type="text" maxLength={80}>`, required
- `bio`: `<textarea maxLength={280}>` with live char counter
- Submit → `PATCH /api/user/profile`

### Account tab

- Email: `<p>` — read-only, no input
- Password form: 3 fields — `autoComplete="current-password"` on current, `autoComplete="new-password"` on new + confirm
- Client-side validation: new ≥ 10 chars, confirm matches — before submit
- Submit → `PATCH /api/user/password` → on success, `router.push("/login?message=password-updated")`

### API Key tab

- Status line: if key on file — "Key on file (last updated {date}, ends in `…{tail}`)" — derived from `settings.apiKeyTail` + `settings.apiKeyUpdatedAt`
- Input: `<input type="password" autoComplete="off" spellCheck={false}>`
- Submit → `PATCH /api/user/api-key`
- **Two-step delete:** First click → button label changes to "Are you sure? Click to confirm." Resets to initial state after 4s timeout or on blur. Second click → `DELETE /api/user/api-key`.
- Cost guidance block (editorial tone, not warning-y) + link to `https://console.anthropic.com/settings/keys`

### Invitations tab

- Read-only table: code, invitee name, invitee email, status (pending/accepted/expired), issued date
- Data: fetched server-side in `page.tsx` via `listUserInvitations(userId)` and passed as a prop — consistent with how `UserSettings` is fetched. No client-side loading state needed. The `GET /api/user/invitations` route is still built (per the brief) but the tab does not call it; it consumes the prop.
- Empty state: one-line editorial message + link to the invite flow entry point (Brief 04)

### Admin tab

- Only rendered if `user.isAdmin === true` — enforced in `page.tsx` before props reach shell
- Single editorial card: heading, description, `<Link href="/admin">Open the Admin panel →</Link>`
- Sage-700 underline link style, editorial register

---

## 5. Security Self-Review

**Trust boundaries:** Client sends plaintext over HTTPS. Server validates via Zod. Server encrypts API key and hashes passwords before persisting. Session is the sole source of `userId`.

**IDOR:** All write queries use `userId` from `requireAuth()` session. No user-supplied ID field is accepted or trusted.

**Key exfiltration:** No GET endpoint returns the full key. Only `apiKeyTail` (4 plaintext chars extracted before encryption) is ever stored or rendered. `decryptApiKey` is never called in the settings flow.

**Brute force / rate limiting:** Password change: 3/10min per user. Requires correct `currentPassword` before accepting new hash.

**Session hygiene:** Password change calls `deleteUserSessions(userId)` — all sessions invalidated server-side. Client redirect to `/login` is UX polish on top of this.

**Admin tab:** Double-gated — server redirect in `page.tsx` for non-admins + tab only passed to shell if `isAdmin`. CSS-hiding alone is explicitly not used.

---

## 6. Verification Checklist

- [ ] `/profile` redirects to `/settings`
- [ ] `/settings` (no query) renders Profile tab
- [ ] `?tab=profile|account|api-key|invitations|admin` each render the correct tab
- [ ] `?tab=admin` as non-admin redirects to `?tab=profile`
- [ ] Non-admin sees 4 tabs; admin sees 5
- [ ] Profile: edit display name + bio, save, refresh — values persist
- [ ] Account: wrong current password → inline error; correct → redirect to `/login`
- [ ] API key: paste → status shows last 4 chars; delete (two-step) → status clears
- [ ] Two-step delete: armed state resets after 4s and on blur
- [ ] Rate limit: 4 password-change attempts in 10 min → 4th returns 429
- [ ] Invitations: shows caller's invites only
- [ ] Admin tab link navigates to `/admin`
- [ ] Keyboard: Left/Right arrows switch tabs; Tab moves into panel
- [ ] Screen reader announces active tab on switch
- [ ] Body text 16px everywhere; visible `<label>` on every field
- [ ] Footer "Settings" link (Brief 16) works
- [ ] `npm run lint && npm run typecheck && npm test` all green
