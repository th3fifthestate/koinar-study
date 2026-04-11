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
  onboarding_completed: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  last_login: string | null;
}

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
  created_at: string;
  updated_at: string;
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

export interface Annotation {
  id: number;
  study_id: number;
  user_id: number;
  type: 'highlight' | 'note';
  content: string | null;
  start_offset: number;
  end_offset: number;
  color: string | null;
  is_public: number;
  created_at: string;
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
