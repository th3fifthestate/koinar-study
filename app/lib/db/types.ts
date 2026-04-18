// app/lib/db/types.ts
// SQLite booleans are number (0 | 1). Dates are ISO 8601 strings.

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: number;
  is_approved: number;
  invited_by: number | null;
  api_key_encrypted: string | null;
  api_key_tail: string | null;
  api_key_updated_at: string | null;
  onboarding_completed: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  last_login: string | null;
}

/** User row without sensitive fields. Safe to pass to API responses. */
export type SafeUser = Omit<User, 'password_hash' | 'api_key_encrypted' | 'locked_until' | 'failed_login_attempts'>;

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface InviteCode {
  id: number;
  code: string;
  created_by: number;
  invitee_name: string;
  invitee_email: string;
  linked_study_id: number | null;
  used_by: number | null;
  created_at: string;
  used_at: string | null;
  is_active: number;
}

export interface EmailVerificationCode {
  id: number;
  invite_code_id: number;
  code: string;
  email: string;
  expires_at: string;
  attempts: number;
  verified: number;
  created_at: string;
}

export interface WaitlistEntry {
  id: number;
  email: string;
  name: string;
  message: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: number | null;
  approval_token: string | null;
  approval_token_expires_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface StudyGiftCode {
  id: number;
  code: string;
  user_id: number;
  format_locked: 'simple' | 'standard' | 'comprehensive';
  max_uses: number;
  uses_remaining: number;
  created_by: number;
  created_at: string;
  expires_at: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  sort_order: number;
}

/** Parsed shape of Study.generation_metadata JSON — not a direct table row. */
export interface StudyGenerationMetadata {
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  duration_ms: number;
  tools_called: string[];
  prompt: string;
}

export interface Study {
  id: number;
  title: string;
  slug: string;
  content_markdown: string;
  summary: string | null;
  format_type: 'simple' | 'standard' | 'comprehensive';
  translation_used: string;
  is_public: number;
  is_featured: number;
  created_by: number;
  category_id: number | null;
  generation_metadata: string | null;
  original_content: string | null;        // BSB source — never overwritten by swap
  current_translation: string;           // last-applied translation, default 'BSB'
  created_at: string;
  updated_at: string;
}

/** Study row without large content fields. Safe for list/card views. */
export type StudySummary = Omit<Study, 'content_markdown' | 'generation_metadata' | 'original_content' | 'current_translation'>;

/** Enriched study for library cards — includes derived fields from JOINs. */
export interface StudyListItem {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  format_type: 'simple' | 'standard' | 'comprehensive';
  translation_used: string;
  is_public: number;
  is_featured: number;
  category_name: string | null;
  category_slug: string | null;
  author_display_name: string | null;
  author_username: string;
  featured_image_url: string | null;
  favorite_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Full study with all related data for the reader view. */
export interface StudyDetail extends Study {
  category_name: string | null;
  category_slug: string | null;
  author_display_name: string | null;
  author_username: string;
  featured_image_url: string | null;
  hero_needs_scrim?: boolean | null;
  favorite_count: number;
  annotation_count: number;
  tags: string[];
  images: StudyImage[];
}

export interface StudyTag {
  id: number;
  study_id: number;
  tag_name: string;
}

export interface Favorite {
  id: number;
  user_id: number;
  study_id: number;
  created_at: string;
}

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface Annotation {
  id: number;
  study_id: number;
  user_id: number;
  type: 'highlight' | 'note';
  color: AnnotationColor;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note_text: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

/** API-safe shape returned by REST endpoints and broadcast over WebSocket.
 *  Never exposes user_id to the client — use is_own for ownership checks. */
export interface AnnotationPayload {
  id: number;
  study_id: number;
  is_own: boolean;
  username: string;
  type: 'highlight' | 'note';
  color: AnnotationColor;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note_text: string | null;
  is_public: boolean;  // coerced from DB integer (0|1) by query layer
  created_at: string;
  updated_at: string;
}

export interface StudyImage {
  id: number;
  study_id: number;
  image_url: string;
  caption: string | null;
  sort_order: number;
  flux_prompt: string | null;
  created_at: string;
}

export interface VerseCache {
  id: number;
  translation: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  text: string;
  cached_at: string;
  lease_duration_hours: number;
  last_accessed_at: string;
  access_count: number;
}

export interface AdminAction {
  id: number;
  admin_id: number;
  action_type: string;
  target_type: string;
  target_id: number | null;
  details: string | null;
  created_at: string;
}

export interface SchemaMigration {
  version: number;
  applied_at: string;
}

// ============================================================
// Entity Knowledge Layer (Brief 07a)
// ============================================================

export interface Entity {
  id: string;
  entity_type: 'person' | 'culture' | 'place' | 'time_period' | 'custom' | 'concept';
  canonical_name: string;
  aliases: string | null;            // JSON array string when present
  quick_glance: string | null;
  summary: string | null;
  full_profile: string | null;
  hebrew_name: string | null;
  greek_name: string | null;
  disambiguation_note: string | null;
  date_range: string | null;
  geographic_context: string | null; // JSON string when present
  source_verified: number;           // 0 | 1
  tipnr_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityVerseRef {
  id: number;
  entity_id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  surface_text: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  created_at: string;
}

export interface EntityCitation {
  id: number;
  entity_id: string;
  source_name: string;
  source_ref: string | null;
  source_url: string | null;
  content_field: 'quick_glance' | 'summary' | 'full_profile' | 'general';
  excerpt: string | null;
  created_at: string;
}

export interface EntityRelationship {
  id: number;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: string;
  relationship_label: string;
  bidirectional: number;             // 0 | 1
  source: string | null;
  created_at: string;
}

export interface StudyEntityAnnotation {
  id: number;
  study_id: number;
  entity_id: string;
  surface_text: string;
  start_offset: number;
  end_offset: number;
  content_hash: string | null;
  annotation_source: 'ai_generation' | 'render_fallback' | 'backfill' | 'manual';
  created_at: string;
}

export interface SavedBranchMap {
  id: number;
  user_id: number;
  study_id: number;
  name: string | null;
  nodes: string;   // JSON array of entity IDs
  edges: string;   // JSON array of relationship IDs
  layout: string | null;  // JSON of node positions
  created_at: string;
  updated_at: string;
}

/** Entity with parsed JSON fields and all related data loaded */
export interface EntityDetail extends Omit<Entity, 'aliases' | 'geographic_context'> {
  aliases: string[];
  geographic_context: { lat: number; lon: number; region: string } | null;
  verse_refs: EntityVerseRef[];
  citations: EntityCitation[];
  relationships: (EntityRelationship & { related_entity_name: string; related_entity_type: string })[];
}

// ============================================================
// TSK Cross-Reference Layer (Brief 31a)
// ============================================================

export interface CrossRef {
  id: number;
  from_book: string;
  from_chapter: number;
  from_verse: number;
  to_book: string;
  to_chapter: number;
  to_verse_start: number;
  to_verse_end: number | null;   // null = single verse; non-null = range end
  votes: number | null;          // TSK relevance score from openbible.info
  source: string;                // default 'tsk'
}

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
