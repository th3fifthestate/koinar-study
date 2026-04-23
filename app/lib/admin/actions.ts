// app/lib/admin/actions.ts
import { getDb } from '@/lib/db/connection';

export type AdminTargetType =
  | 'user'
  | 'study'
  | 'waitlist'
  | 'invite_code'
  | 'gift_code'
  | 'image';

/**
 * Log an admin action to the admin_actions table.
 * actionType follows verb_object convention: 'ban_user', 'feature_study', etc.
 * Both targetType and targetId are required — every admin action has a subject.
 */
export function logAdminAction(args: {
  adminId: number;
  actionType: string;
  targetType: AdminTargetType;
  targetId: number;
  details?: Record<string, unknown>;
}): void {
  getDb()
    .prepare(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      args.adminId,
      args.actionType,
      args.targetType,
      args.targetId,
      args.details ? JSON.stringify(args.details) : null
    );
}
