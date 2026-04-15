// app/lib/db/queries.ts
import { getDb } from './connection';
import type {
  Annotation,
  AnnotationColor,
  AnnotationPayload,
  Category,
  EmailVerificationCode,
  InviteCode,
  SafeUser,
  Session,
  Study,
  StudyDetail,
  StudyGiftCode,
  StudyImage,
  StudyListItem,
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

/** Invalidate all prior unverified codes for this invite, then insert a new one. */
export function createVerificationCode(
  inviteCodeId: number,
  email: string,
  code: string,
  expiresAt: string
): number {
  const db = getDb();
  let id: number;
  db.transaction(() => {
    // Expire any outstanding codes for this invite to prevent code accumulation
    db.prepare(
      `UPDATE email_verification_codes
       SET expires_at = datetime('now', '-1 second')
       WHERE invite_code_id = ? AND verified = 0 AND expires_at > datetime('now')`
    ).run(inviteCodeId);

    id = db
      .prepare(
        `INSERT INTO email_verification_codes (invite_code_id, email, code, expires_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(inviteCodeId, email, code, expiresAt)
      .lastInsertRowid as number;
  })();
  return id!;
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
  const stmt = getDb().prepare(
    `INSERT INTO studies
       (title, slug, content_markdown, summary, format_type, translation_used,
        created_by, category_id, generation_metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const params = [
    data.title,
    data.slug,
    data.content_markdown,
    data.summary ?? null,
    data.format_type,
    data.translation_used,
    data.created_by,
    data.category_id ?? null,
    data.generation_metadata ?? null,
  ];

  // Retry with random suffix on UNIQUE constraint violation (slug collision)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const slug = attempt === 0
        ? data.slug
        : `${data.slug.slice(0, 80)}-${Math.random().toString(36).slice(2, 6)}`;
      params[1] = slug;
      return stmt.run(...params).lastInsertRowid as number;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('UNIQUE constraint') && msg.includes('slug') && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to create study after slug collision retries');
}

// ─── Library queries (enriched with JOINs) ───────────────────────────────────

export interface GetStudiesOptions {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
  sort?: 'newest' | 'oldest' | 'popular';
  format_type?: string;
  userId?: number; // for user-specific studies; omit for public only
  favoritesOfUserId?: number; // filter to only studies favorited by this user
}

export function getStudies(opts: GetStudiesOptions = {}): { studies: StudyListItem[]; totalCount: number } {
  const db = getDb();
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 50);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Visibility: either public or user's own
  if (opts.userId) {
    conditions.push('(s.is_public = 1 OR s.created_by = ?)');
    params.push(opts.userId);
  } else {
    conditions.push('s.is_public = 1');
  }

  if (opts.category) {
    conditions.push('c.slug = ?');
    params.push(opts.category);
  }

  if (opts.format_type) {
    conditions.push('s.format_type = ?');
    params.push(opts.format_type);
  }

  let ftsJoin = '';
  if (opts.q && opts.q.trim().length > 0) {
    ftsJoin = 'INNER JOIN studies_fts ON studies_fts.rowid = s.id';
    conditions.push('studies_fts MATCH ?');
    const safeQuery = opts.q.trim().replace(/['"*(){}[\]^~\\:]/g, '').slice(0, 200);
    params.push(safeQuery);
  }

  let favJoin = '';
  if (opts.favoritesOfUserId) {
    favJoin = 'INNER JOIN favorites fav_filter ON fav_filter.study_id = s.id AND fav_filter.user_id = ?';
    params.push(opts.favoritesOfUserId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (opts.sort) {
    case 'oldest':
      orderBy = 'ORDER BY s.created_at ASC';
      break;
    case 'popular':
      orderBy = 'ORDER BY favorite_count DESC, s.created_at DESC';
      break;
    default:
      orderBy = 'ORDER BY s.created_at DESC';
  }

  // Count query
  const countSql = `
    SELECT COUNT(*) as total
    FROM studies s
    LEFT JOIN categories c ON c.id = s.category_id
    ${ftsJoin}
    ${favJoin}
    ${where}
  `;
  const countParams = [...params];
  const { total } = db.prepare(countSql).get(...countParams) as { total: number };

  // Main query with enriched fields
  const sql = `
    SELECT
      s.id, s.title, s.slug, s.summary, s.format_type, s.translation_used,
      s.is_public, s.is_featured, s.created_at, s.updated_at,
      c.name AS category_name, c.slug AS category_slug,
      u.display_name AS author_display_name, u.username AS author_username,
      (SELECT image_url FROM study_images si WHERE si.study_id = s.id ORDER BY si.sort_order LIMIT 1) AS featured_image_url,
      (SELECT COUNT(*) FROM favorites f WHERE f.study_id = s.id) AS favorite_count
    FROM studies s
    LEFT JOIN categories c ON c.id = s.category_id
    INNER JOIN users u ON u.id = s.created_by
    ${ftsJoin}
    ${favJoin}
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limit, offset) as (Omit<StudyListItem, 'tags'>)[];

  // Batch-fetch tags for all studies in the result set (single query, not N+1)
  const studyIds = rows.map((r) => r.id);
  const tagMap = new Map<number, string[]>();
  if (studyIds.length > 0) {
    const placeholders = studyIds.map(() => '?').join(',');
    const tagRows = db
      .prepare(`SELECT study_id, tag_name FROM study_tags WHERE study_id IN (${placeholders}) ORDER BY tag_name`)
      .all(...studyIds) as { study_id: number; tag_name: string }[];
    for (const t of tagRows) {
      const arr = tagMap.get(t.study_id) ?? [];
      arr.push(t.tag_name);
      tagMap.set(t.study_id, arr);
    }
  }
  const studies: StudyListItem[] = rows.map((row) => ({
    ...row,
    tags: tagMap.get(row.id) ?? [],
  }));

  return { studies, totalCount: total };
}

/**
 * Full study with all related data for the reader view.
 * Returns null if study doesn't exist or isn't accessible.
 */
export function getStudyDetail(slug: string, userId?: number): StudyDetail | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT
      s.id, s.title, s.slug, s.content_markdown, s.summary,
      s.format_type, s.translation_used, s.is_public, s.is_featured,
      s.created_by, s.category_id, s.generation_metadata, s.created_at, s.updated_at,
      c.name AS category_name, c.slug AS category_slug,
      u.display_name AS author_display_name, u.username AS author_username,
      (SELECT image_url FROM study_images si WHERE si.study_id = s.id ORDER BY si.sort_order LIMIT 1) AS featured_image_url,
      (SELECT COUNT(*) FROM favorites f WHERE f.study_id = s.id) AS favorite_count,
      (SELECT COUNT(*) FROM annotations a WHERE a.study_id = s.id AND a.is_public = 1) AS annotation_count
    FROM studies s
    LEFT JOIN categories c ON c.id = s.category_id
    INNER JOIN users u ON u.id = s.created_by
    WHERE s.slug = ?
  `).get(slug) as (Study & {
    category_name: string | null;
    category_slug: string | null;
    author_display_name: string | null;
    author_username: string;
    featured_image_url: string | null;
    favorite_count: number;
    annotation_count: number;
  }) | undefined;

  if (!row) return null;

  // Check visibility
  if (!row.is_public && row.created_by !== userId) return null;

  const tags = db
    .prepare('SELECT tag_name FROM study_tags WHERE study_id = ? ORDER BY tag_name')
    .all(row.id) as { tag_name: string }[];

  const images = db
    .prepare('SELECT * FROM study_images WHERE study_id = ? ORDER BY sort_order')
    .all(row.id) as StudyImage[];

  return {
    ...row,
    tags: tags.map((t) => t.tag_name),
    images,
  };
}

/** Check if a user has favorited a specific study */
export function isStudyFavorited(userId: number, studyId: number): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND study_id = ?')
    .get(userId, studyId);
  return !!row;
}

/** Get the count of favorites for a study */
export function getStudyFavoriteCount(studyId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM favorites WHERE study_id = ?')
    .get(studyId) as { count: number };
  return row.count;
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

/** Returns just the study IDs a user has favorited. Much cheaper than getUserFavorites(). */
export function getUserFavoriteIds(userId: number): Set<number> {
  const rows = getDb()
    .prepare('SELECT study_id FROM favorites WHERE user_id = ?')
    .all(userId) as { study_id: number }[];
  return new Set(rows.map((r) => r.study_id));
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

export function getWaitlistByEmail(email: string): WaitlistEntry | null {
  return (
    (getDb()
      .prepare("SELECT * FROM waitlist WHERE email = ?")
      .get(email) as WaitlistEntry | undefined) ?? null
  );
}

export function getWaitlistByApprovalToken(token: string): WaitlistEntry | null {
  return (
    (getDb()
      .prepare(
        `SELECT * FROM waitlist
         WHERE approval_token = ? AND approval_token_expires_at > datetime('now')`
      )
      .get(token) as WaitlistEntry | undefined) ?? null
  );
}

export function approveWaitlistEntry(
  id: number,
  reviewedBy: number,
  approvalToken: string,
  approvalTokenExpiresAt: string
): void {
  getDb()
    .prepare(
      `UPDATE waitlist
       SET status = 'approved', reviewed_by = ?, approval_token = ?,
           approval_token_expires_at = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    )
    .run(reviewedBy, approvalToken, approvalTokenExpiresAt, id);
}

export function denyWaitlistEntry(id: number, reviewedBy: number): void {
  getDb()
    .prepare(
      `UPDATE waitlist SET status = 'denied', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    )
    .run(reviewedBy, id);
}

// ─── Annotation queries ───────────────────────────────────────────────────────

/**
 * Returns annotations for a study visible to the given user:
 * - All public annotations (is_public=1) from any user
 * - The requesting user's own private annotations
 * Returns shaped AnnotationPayload objects — no raw DB rows.
 */
export function getAnnotationsForStudy(studyId: number, userId: number): AnnotationPayload[] {
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.study_id, a.user_id, u.username,
              a.type, a.color, a.start_offset, a.end_offset,
              a.selected_text, a.note_text, a.is_public,
              a.created_at, a.updated_at
         FROM annotations a
         JOIN users u ON u.id = a.user_id
        WHERE a.study_id = ?
          AND (a.is_public = 1 OR a.user_id = ?)
        ORDER BY a.start_offset ASC`
    )
    .all(studyId, userId) as (Omit<AnnotationPayload, 'is_public'> & { is_public: number })[];

  return rows.map((r) => ({ ...r, is_public: r.is_public === 1 }));
}

/** Returns a single annotation with username. Returns null if not found. */
export function getAnnotationById(annotationId: number): AnnotationPayload | null {
  const row = getDb()
    .prepare(
      `SELECT a.id, a.study_id, a.user_id, u.username,
              a.type, a.color, a.start_offset, a.end_offset,
              a.selected_text, a.note_text, a.is_public,
              a.created_at, a.updated_at
         FROM annotations a
         JOIN users u ON u.id = a.user_id
        WHERE a.id = ?`
    )
    .get(annotationId) as (Omit<AnnotationPayload, 'is_public'> & { is_public: number }) | undefined;

  if (!row) return null;
  return { ...row, is_public: row.is_public === 1 };
}

export interface CreateAnnotationInput {
  studyId: number;
  userId: number;
  type: 'highlight' | 'note';
  color: AnnotationColor;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  noteText?: string | null;
  isPublic: boolean;
}

/**
 * Inserts a new annotation and returns the full AnnotationPayload (with username via JOIN).
 */
export function createAnnotation(input: CreateAnnotationInput): AnnotationPayload {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO annotations
         (study_id, user_id, type, color, start_offset, end_offset, selected_text, note_text, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.studyId,
      input.userId,
      input.type,
      input.color,
      input.startOffset,
      input.endOffset,
      input.selectedText,
      input.noteText ?? null,
      input.isPublic ? 1 : 0
    );

  const annotation = getAnnotationById(result.lastInsertRowid as number);
  if (!annotation) throw new Error('Failed to retrieve created annotation');
  return annotation;
}

/**
 * Deletes an annotation by ID. Returns true if a row was deleted, false if not found.
 * Callers must verify ownership before calling.
 */
export function deleteAnnotation(annotationId: number): boolean {
  const result = getDb()
    .prepare('DELETE FROM annotations WHERE id = ?')
    .run(annotationId);
  return result.changes > 0;
}

/**
 * Returns an annotation owned by a specific user in a specific study, or null.
 * Used to verify ownership before DELETE — prevents users deleting others' annotations.
 */
export function getAnnotationForOwner(
  annotationId: number,
  userId: number,
  studyId: number
): Annotation | null {
  return (
    (getDb()
      .prepare('SELECT * FROM annotations WHERE id = ? AND user_id = ? AND study_id = ?')
      .get(annotationId, userId, studyId) as Annotation | undefined) ?? null
  );
}
