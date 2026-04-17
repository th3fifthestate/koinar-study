// app/lib/db/schema.ts

export const SCHEMA_VERSION = 8;

export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_approved INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  invited_by INTEGER REFERENCES users(id),
  api_key_encrypted TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  linked_study_id INTEGER REFERENCES studies(id) ON DELETE SET NULL,
  used_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_code_id INTEGER NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by INTEGER REFERENCES users(id),
  approval_token TEXT UNIQUE,
  approval_token_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS study_gift_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format_locked TEXT NOT NULL CHECK (format_locked IN ('simple', 'standard', 'comprehensive')),
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_remaining INTEGER NOT NULL CHECK (uses_remaining >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  summary TEXT,
  format_type TEXT NOT NULL DEFAULT 'comprehensive' CHECK (format_type IN ('simple', 'standard', 'comprehensive')),
  translation_used TEXT NOT NULL DEFAULT 'BSB',
  is_public INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  generation_metadata TEXT,
  original_content TEXT,
  current_translation TEXT NOT NULL DEFAULT 'BSB',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  UNIQUE(study_id, tag_name)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, study_id)
);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('highlight', 'note')),
  color TEXT NOT NULL DEFAULT 'yellow' CHECK(color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL CHECK(end_offset > start_offset),
  selected_text TEXT NOT NULL,
  note_text TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  flux_prompt TEXT,
  r2_key TEXT,
  style TEXT NOT NULL DEFAULT 'cinematic',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  size_bytes INTEGER,
  is_hero INTEGER NOT NULL DEFAULT 0,
  flux_task_id TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seasonal_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL CHECK(season IN ('spring', 'summer', 'autumn', 'winter')),
  r2_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  flux_prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verse_cache (
  translation    TEXT    NOT NULL,
  book           TEXT    NOT NULL,
  chapter        INTEGER NOT NULL,
  verse          INTEGER NOT NULL,
  text           TEXT    NOT NULL,
  fetched_at     INTEGER NOT NULL,
  lease_expires  INTEGER NOT NULL,
  last_access    INTEGER NOT NULL,
  fums_token     TEXT,
  PRIMARY KEY (translation, book, chapter, verse)
);

CREATE TABLE IF NOT EXISTS fums_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  translation   TEXT    NOT NULL,
  fums_token    TEXT,
  event_type    TEXT    NOT NULL CHECK (event_type IN ('fetch', 'display')),
  study_id      INTEGER,
  user_id       INTEGER,
  verse_count   INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  flushed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS renewal_meta (
  key         TEXT PRIMARY KEY,
  value_int   INTEGER
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS studies_fts USING fts5(
  title,
  summary,
  content_markdown,
  content='studies',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS studies_fts_insert AFTER INSERT ON studies BEGIN
  INSERT INTO studies_fts(rowid, title, summary, content_markdown)
  VALUES (new.id, new.title, new.summary, new.content_markdown);
END;

CREATE TRIGGER IF NOT EXISTS studies_fts_update AFTER UPDATE OF title, summary, content_markdown ON studies BEGIN
  INSERT INTO studies_fts(studies_fts, rowid, title, summary, content_markdown)
  VALUES ('delete', old.id, old.title, old.summary, old.content_markdown);
  INSERT INTO studies_fts(rowid, title, summary, content_markdown)
  VALUES (new.id, new.title, new.summary, new.content_markdown);
END;

CREATE TRIGGER IF NOT EXISTS studies_fts_delete AFTER DELETE ON studies BEGIN
  INSERT INTO studies_fts(studies_fts, rowid, title, summary, content_markdown)
  VALUES ('delete', old.id, old.title, old.summary, old.content_markdown);
END;

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person', 'culture', 'place', 'time_period', 'custom', 'concept'
  )),
  canonical_name TEXT NOT NULL,
  aliases TEXT,
  quick_glance TEXT,
  summary TEXT,
  full_profile TEXT,
  hebrew_name TEXT,
  greek_name TEXT,
  disambiguation_note TEXT,
  date_range TEXT,
  geographic_context TEXT,
  source_verified INTEGER NOT NULL DEFAULT 1,
  tipnr_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_verse_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  surface_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_ref TEXT,
  source_url TEXT,
  content_field TEXT NOT NULL CHECK (content_field IN (
    'quick_glance', 'summary', 'full_profile', 'general'
  )),
  excerpt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  relationship_label TEXT NOT NULL,
  bidirectional INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- For bidirectional=1 edges, normalize: always insert with from_entity_id < to_entity_id to prevent symmetric duplicates.
  UNIQUE(from_entity_id, to_entity_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS study_entity_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  surface_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  content_hash TEXT,
  annotation_source TEXT NOT NULL DEFAULT 'ai_generation' CHECK (
    annotation_source IN ('ai_generation', 'render_fallback', 'backfill', 'manual')
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_branch_maps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  layout TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  canonical_name,
  aliases,
  quick_glance,
  summary,
  content='entities',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, canonical_name, aliases, quick_glance, summary)
  VALUES (new.rowid, new.canonical_name, new.aliases, new.quick_glance, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities
WHEN old.canonical_name IS NOT new.canonical_name OR
     old.aliases IS NOT new.aliases OR
     old.quick_glance IS NOT new.quick_glance OR
     old.summary IS NOT new.summary BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, canonical_name, aliases, quick_glance, summary)
  VALUES ('delete', old.rowid, old.canonical_name, old.aliases, old.quick_glance, old.summary);
  INSERT INTO entities_fts(rowid, canonical_name, aliases, quick_glance, summary)
  VALUES (new.rowid, new.canonical_name, new.aliases, new.quick_glance, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, canonical_name, aliases, quick_glance, summary)
  VALUES ('delete', old.rowid, old.canonical_name, old.aliases, old.quick_glance, old.summary);
END;
`;

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON invite_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_codes_invitee_email ON invite_codes(invitee_email);
CREATE INDEX IF NOT EXISTS idx_email_verification_invite ON email_verification_codes(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_approval_token ON waitlist(approval_token);
CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON study_gift_codes(code);
CREATE INDEX IF NOT EXISTS idx_gift_codes_user ON study_gift_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_codes_created_by ON study_gift_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_studies_slug ON studies(slug);
CREATE INDEX IF NOT EXISTS idx_studies_created_by ON studies(created_by);
CREATE INDEX IF NOT EXISTS idx_studies_category ON studies(category_id);
CREATE INDEX IF NOT EXISTS idx_studies_public ON studies(is_public);
CREATE INDEX IF NOT EXISTS idx_studies_featured ON studies(is_featured, created_at);
CREATE INDEX IF NOT EXISTS idx_studies_created_at ON studies(created_at);
CREATE INDEX IF NOT EXISTS idx_study_tags_study ON study_tags(study_id);
CREATE INDEX IF NOT EXISTS idx_study_tags_name ON study_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_study ON favorites(study_id);
CREATE INDEX IF NOT EXISTS idx_annotations_study ON annotations(study_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_study_public ON annotations(study_id, is_public);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(study_id, type);
CREATE INDEX IF NOT EXISTS idx_study_images_study ON study_images(study_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_study_images_hero ON study_images(study_id, is_hero);
CREATE INDEX IF NOT EXISTS idx_seasonal_images_season ON seasonal_images(season);
CREATE INDEX IF NOT EXISTS idx_seasonal_images_active ON seasonal_images(is_active);
CREATE INDEX IF NOT EXISTS idx_verse_cache_lease ON verse_cache(translation, lease_expires);
CREATE INDEX IF NOT EXISTS idx_verse_cache_access ON verse_cache(translation, last_access);
CREATE INDEX IF NOT EXISTS idx_fums_events_flushed ON fums_events(flushed_at);
CREATE INDEX IF NOT EXISTS idx_fums_events_created ON fums_events(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities(canonical_name);
CREATE INDEX IF NOT EXISTS idx_entities_tipnr ON entities(tipnr_id);
CREATE INDEX IF NOT EXISTS idx_entities_source_verified ON entities(source_verified);
CREATE INDEX IF NOT EXISTS idx_entity_verse_refs_entity ON entity_verse_refs(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_verse_refs_verse ON entity_verse_refs(book, chapter, verse_start);
CREATE INDEX IF NOT EXISTS idx_entity_verse_refs_confidence ON entity_verse_refs(confidence);
CREATE INDEX IF NOT EXISTS idx_entity_citations_entity ON entity_citations(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rels_from ON entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rels_to ON entity_relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rels_type ON entity_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_study_entity_annot_study ON study_entity_annotations(study_id);
CREATE INDEX IF NOT EXISTS idx_study_entity_annot_entity ON study_entity_annotations(entity_id);
CREATE INDEX IF NOT EXISTS idx_saved_branch_maps_user ON saved_branch_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_branch_maps_study ON saved_branch_maps(study_id, user_id);
`;

export const SEED_CATEGORIES = `
INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES
  ('Old Testament', 'old-testament', 'Studies focused on Old Testament books and passages', 1),
  ('New Testament', 'new-testament', 'Studies focused on New Testament books and passages', 2),
  ('Topical', 'topical', 'Studies exploring themes across the entire Bible', 3),
  ('People', 'people', 'Studies on individuals and groups in the Bible', 4),
  ('Word Studies', 'word-studies', 'Deep dives into Hebrew and Greek words', 5),
  ('Book Studies', 'book-studies', 'Comprehensive overviews of entire biblical books', 6),
  ('Prophecy', 'prophecy', 'Studies on prophetic passages and their fulfillment', 7),
  ('Wisdom', 'wisdom', 'Studies from Proverbs, Ecclesiastes, Job, and wisdom literature', 8),
  ('Gospel', 'gospel', 'Studies focused on the life and teachings of Jesus', 9),
  ('Letters', 'letters', 'Studies from the epistles and apostolic letters', 10);
`;
