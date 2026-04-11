// app/lib/db/queries.ts
import { getDb } from './connection';
import type {
  Category,
  EmailVerificationCode,
  InviteCode,
  Study,
  StudyGiftCode,
  User,
  WaitlistEntry,
} from './types';

// ─── User queries ────────────────────────────────────────────────────────────

/** Returns the full User row including password_hash and api_key_encrypted. Strip sensitive fields before including in any API response. */
export function getUserById(id: number): User | null {
  return (
    (getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ?? null
  );
}

export function getUserByEmail(email: string): User | null {
  return (
    (getDb()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User | undefined) ?? null
  );
}

export function getUserByUsername(username: string): User | null {
  return (
    (getDb()
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as User | undefined) ?? null
  );
}

export function createUser(data: {
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  invited_by?: number;
  is_approved?: number;
  is_admin?: number;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, email, password_hash, display_name, invited_by, is_approved, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.username,
      data.email,
      data.password_hash,
      data.display_name ?? null,
      data.invited_by ?? null,
      data.is_approved ?? 0,
      data.is_admin ?? 0
    );
  return result.lastInsertRowid as number;
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

export function markInviteCodeUsed(code: string, usedBy: number): void {
  getDb()
    .prepare(
      `UPDATE invite_codes SET used_by = ?, used_at = datetime('now'), is_active = 0 WHERE code = ?`
    )
    .run(usedBy, code);
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
        'SELECT * FROM email_verification_codes WHERE invite_code_id = ? AND code = ?'
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

export function decrementGiftCodeUse(id: number): boolean {
  const result = getDb()
    .prepare(
      'UPDATE study_gift_codes SET uses_remaining = uses_remaining - 1 WHERE id = ? AND uses_remaining > 0'
    )
    .run(id);
  return result.changes === 1;
}

// ─── Study queries ────────────────────────────────────────────────────────────

export function getStudyBySlug(slug: string): Study | null {
  return (
    (getDb()
      .prepare('SELECT * FROM studies WHERE slug = ?')
      .get(slug) as Study | undefined) ?? null
  );
}

export function getPublicStudies(limit = 20, offset = 0): Study[] {
  return getDb()
    .prepare(
      'SELECT * FROM studies WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset) as Study[];
}

export function getFeaturedStudies(limit = 6): Study[] {
  return getDb()
    .prepare(
      'SELECT * FROM studies WHERE is_public = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT ?'
    )
    .all(limit) as Study[];
}

export function getStudiesByCategory(
  categoryId: number,
  limit = 20,
  offset = 0
): Study[] {
  return getDb()
    .prepare(
      `SELECT * FROM studies
       WHERE is_public = 1 AND category_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(categoryId, limit, offset) as Study[];
}

/** Returns ALL studies for the user including private/draft ones. Only call with a userId from the authenticated session. */
export function getUserStudies(userId: number): Study[] {
  return getDb()
    .prepare('SELECT * FROM studies WHERE created_by = ? ORDER BY created_at DESC')
    .all(userId) as Study[];
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
