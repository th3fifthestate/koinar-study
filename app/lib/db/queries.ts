// app/lib/db/queries.ts
import { getDb } from './connection';
import type {
  Category,
  EmailVerificationCode,
  InviteCode,
  SafeUser,
  Session,
  Study,
  StudyGiftCode,
  StudySummary,
  User,
  WaitlistEntry,
} from './types';

const SAFE_USER_COLUMNS = `id, username, email, display_name, bio, avatar_url, is_admin, is_approved, invited_by, onboarding_completed, created_at, last_login`;

// ─── User queries ────────────────────────────────────────────────────────────

export function getUserById(id: number): SafeUser | null {
  return (
    (getDb().prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = ?`).get(id) as SafeUser | undefined) ?? null
  );
}

export function getUserByEmail(email: string): SafeUser | null {
  return (
    (getDb()
      .prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE email = ?`)
      .get(email) as SafeUser | undefined) ?? null
  );
}

export function getUserByUsername(username: string): SafeUser | null {
  return (
    (getDb()
      .prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE username = ?`)
      .get(username) as SafeUser | undefined) ?? null
  );
}

/** Returns full User row including password_hash for auth flows ONLY. Never expose to API responses. */
export function getUserForAuth(email: string): User | null {
  return (
    (getDb()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User | undefined) ?? null
  );
}

export function createUser(data: {
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  invited_by?: number;
  is_approved?: number;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, email, password_hash, display_name, invited_by, is_approved)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.username,
      data.email,
      data.password_hash,
      data.display_name ?? null,
      data.invited_by ?? null,
      data.is_approved ?? 0
    );
  return result.lastInsertRowid as number;
}

export function setUserAdmin(userId: number, isAdmin: boolean): void {
  getDb()
    .prepare('UPDATE users SET is_admin = ? WHERE id = ?')
    .run(isAdmin ? 1 : 0, userId);
}

// ─── Session queries ─────────────────────────────────────────────────────────

export function createSession(userId: number, token: string, expiresAt: string): number {
  const result = getDb()
    .prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(userId, token, expiresAt);
  return result.lastInsertRowid as number;
}

export function getSessionByToken(token: string): (Session & { user_id: number }) | null {
  return (
    (getDb()
      .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')')
      .get(token) as (Session & { user_id: number }) | undefined) ?? null
  );
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteExpiredSessions(): number {
  const result = getDb()
    .prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')')
    .run();
  return result.changes;
}

export function deleteUserSessions(userId: number): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ─── Invite code queries ──────────────────────────────────────────────────────

export function getInviteCode(code: string): InviteCode | null {
  return (
    (getDb()
      .prepare('SELECT * FROM invite_codes WHERE code = ?')
      .get(code) as InviteCode | undefined) ?? null
  );
}

export function createInviteCode(data: {
  code: string;
  created_by: number;
  invitee_name: string;
  invitee_email: string;
  linked_study_id?: number | null;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, linked_study_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(data.code, data.created_by, data.invitee_name, data.invitee_email, data.linked_study_id ?? null);
  return result.lastInsertRowid as number;
}

export function markInviteCodeUsed(code: string, usedBy: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE invite_codes SET used_by = ?, used_at = datetime('now'), is_active = 0
       WHERE code = ? AND is_active = 1`
    )
    .run(usedBy, code);
  return result.changes === 1;
}

export function getInviteCountForUser(userId: number, days: number): number {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`getInviteCountForUser: days must be a positive finite number, got ${days}`);
  }
  const modifier = `-${Math.floor(days)} days`;
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as count FROM invite_codes
       WHERE created_by = ? AND created_at >= datetime('now', ?)`
    )
    .get(userId, modifier) as { count: number };
  return row.count;
}

// ─── Email verification queries ───────────────────────────────────────────────

export function createVerificationCode(
  inviteCodeId: number,
  email: string,
  code: string,
  expiresAt: string
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO email_verification_codes (invite_code_id, email, code, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(inviteCodeId, email, code, expiresAt);
  return result.lastInsertRowid as number;
}

export function getVerificationCode(
  inviteCodeId: number,
  code: string
): EmailVerificationCode | null {
  return (
    (getDb()
      .prepare(
        `SELECT * FROM email_verification_codes
         WHERE invite_code_id = ? AND code = ?
           AND verified = 0
           AND expires_at > datetime('now')
           AND attempts < 5`
      )
      .get(inviteCodeId, code) as EmailVerificationCode | undefined) ?? null
  );
}

export function incrementVerificationAttempts(id: number): void {
  getDb()
    .prepare('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?')
    .run(id);
}

export function markVerificationVerified(id: number): void {
  getDb()
    .prepare('UPDATE email_verification_codes SET verified = 1 WHERE id = ?')
    .run(id);
}

// ─── Gift code queries ────────────────────────────────────────────────────────

export function getGiftCode(code: string): StudyGiftCode | null {
  return (
    (getDb()
      .prepare('SELECT * FROM study_gift_codes WHERE code = ?')
      .get(code) as StudyGiftCode | undefined) ?? null
  );
}

export function getActiveGiftCodesForUser(userId: number): StudyGiftCode[] {
  return getDb()
    .prepare(
      `SELECT * FROM study_gift_codes
       WHERE user_id = ? AND uses_remaining > 0
         AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .all(userId) as StudyGiftCode[];
}

/**
 * Atomically consume one use of a gift code. Returns the gift code row if
 * successful, null if the code has no remaining uses or has expired.
 * Combines read + decrement in a single transaction to prevent TOCTOU races.
 */
export function consumeGiftCode(
  code: string,
  format: 'simple' | 'standard' | 'comprehensive'
): StudyGiftCode | null {
  const database = getDb();
  let consumed: StudyGiftCode | null = null;
  database.transaction(() => {
    const result = database
      .prepare(
        `UPDATE study_gift_codes
         SET uses_remaining = uses_remaining - 1
         WHERE code = ? AND format_locked = ? AND uses_remaining > 0
           AND (expires_at IS NULL OR expires_at > datetime('now'))`
      )
      .run(code, format);
    if (result.changes === 1) {
      consumed = database
        .prepare('SELECT * FROM study_gift_codes WHERE code = ?')
        .get(code) as StudyGiftCode;
    }
  })();
  return consumed;
}

// ─── Study queries ────────────────────────────────────────────────────────────

const STUDY_SUMMARY_COLUMNS = `id, title, slug, summary, format_type, translation_used, is_public, is_featured, created_by, category_id, created_at, updated_at`;

export function getStudyById(id: number): Study | null {
  return (
    (getDb()
      .prepare('SELECT * FROM studies WHERE id = ?')
      .get(id) as Study | undefined) ?? null
  );
}

export function getStudyBySlug(slug: string): Study | null {
  return (
    (getDb()
      .prepare('SELECT * FROM studies WHERE slug = ?')
      .get(slug) as Study | undefined) ?? null
  );
}

export function getPublicStudies(limit = 20, offset = 0): StudySummary[] {
  return getDb()
    .prepare(
      `SELECT ${STUDY_SUMMARY_COLUMNS} FROM studies WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as StudySummary[];
}

export function getFeaturedStudies(limit = 6): StudySummary[] {
  return getDb()
    .prepare(
      `SELECT ${STUDY_SUMMARY_COLUMNS} FROM studies WHERE is_public = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as StudySummary[];
}

export function getStudiesByCategory(
  categoryId: number,
  limit = 20,
  offset = 0
): StudySummary[] {
  return getDb()
    .prepare(
      `SELECT ${STUDY_SUMMARY_COLUMNS} FROM studies
       WHERE is_public = 1 AND category_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(categoryId, limit, offset) as StudySummary[];
}

/** Returns ALL studies for the user including private/draft ones. Only call with a userId from the authenticated session. */
export function getUserStudies(userId: number): StudySummary[] {
  return getDb()
    .prepare(`SELECT ${STUDY_SUMMARY_COLUMNS} FROM studies WHERE created_by = ? ORDER BY created_at DESC`)
    .all(userId) as StudySummary[];
}

export function createStudy(data: {
  title: string;
  slug: string;
  content_markdown: string;
  summary?: string;
  format_type: 'simple' | 'standard' | 'comprehensive';
  translation_used: string;
  created_by: number;
  category_id?: number;
  generation_metadata?: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO studies
         (title, slug, content_markdown, summary, format_type, translation_used,
          created_by, category_id, generation_metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      data.slug,
      data.content_markdown,
      data.summary ?? null,
      data.format_type,
      data.translation_used,
      data.created_by,
      data.category_id ?? null,
      data.generation_metadata ?? null
    );
  return result.lastInsertRowid as number;
}

// ─── Category queries ─────────────────────────────────────────────────────────

export function getAllCategories(): Category[] {
  return getDb()
    .prepare('SELECT * FROM categories ORDER BY sort_order')
    .all() as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  return (
    (getDb()
      .prepare('SELECT * FROM categories WHERE slug = ?')
      .get(slug) as Category | undefined) ?? null
  );
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export function toggleFavorite(userId: number, studyId: number): boolean {
  const database = getDb();
  let favorited = false;
  database.transaction(() => {
    const existing = database
      .prepare('SELECT id FROM favorites WHERE user_id = ? AND study_id = ?')
      .get(userId, studyId);

    if (existing) {
      database
        .prepare('DELETE FROM favorites WHERE user_id = ? AND study_id = ?')
        .run(userId, studyId);
      favorited = false;
    } else {
      database
        .prepare('INSERT INTO favorites (user_id, study_id) VALUES (?, ?)')
        .run(userId, studyId);
      favorited = true;
    }
  })();
  return favorited;
}

export function getUserFavorites(userId: number): Study[] {
  return getDb()
    .prepare(
      `SELECT s.* FROM studies s
       INNER JOIN favorites f ON f.study_id = s.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(userId) as Study[];
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function setStudyTags(studyId: number, tags: string[]): void {
  const database = getDb();
  database.transaction(() => {
    database.prepare('DELETE FROM study_tags WHERE study_id = ?').run(studyId);
    const insert = database.prepare(
      'INSERT INTO study_tags (study_id, tag_name) VALUES (?, ?)'
    );
    for (const tag of tags) {
      insert.run(studyId, tag);
    }
  })();
}

export function getStudyTags(studyId: number): string[] {
  const rows = getDb()
    .prepare('SELECT tag_name FROM study_tags WHERE study_id = ? ORDER BY tag_name')
    .all(studyId) as { tag_name: string }[];
  return rows.map((r) => r.tag_name);
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export function createWaitlistEntry(data: {
  email: string;
  name: string;
  message?: string;
}): number {
  const result = getDb()
    .prepare('INSERT INTO waitlist (email, name, message) VALUES (?, ?, ?)')
    .run(data.email, data.name, data.message ?? null);
  return result.lastInsertRowid as number;
}

export function getPendingWaitlist(): WaitlistEntry[] {
  return getDb()
    .prepare("SELECT * FROM waitlist WHERE status = 'pending' ORDER BY created_at ASC")
    .all() as WaitlistEntry[];
}
