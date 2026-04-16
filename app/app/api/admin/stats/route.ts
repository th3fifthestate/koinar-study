import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const db = getDb();

  const userCount = (
    db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }
  ).n;

  const approvedCount = (
    db.prepare('SELECT COUNT(*) as n FROM users WHERE is_approved = 1').get() as { n: number }
  ).n;

  const bannedCount = (
    db.prepare('SELECT COUNT(*) as n FROM users WHERE is_banned = 1').get() as { n: number }
  ).n;

  const pendingWaitlistCount = (
    db
      .prepare("SELECT COUNT(*) as n FROM waitlist WHERE status = 'pending'")
      .get() as { n: number }
  ).n;

  const studyCount = (
    db.prepare('SELECT COUNT(*) as n FROM studies').get() as { n: number }
  ).n;

  const publicStudyCount = (
    db.prepare('SELECT COUNT(*) as n FROM studies WHERE is_public = 1').get() as { n: number }
  ).n;

  const featuredStudyCount = (
    db.prepare('SELECT COUNT(*) as n FROM studies WHERE is_featured = 1').get() as { n: number }
  ).n;

  const imageCount = (
    db.prepare('SELECT COUNT(*) as n FROM study_images').get() as { n: number }
  ).n;

  const recentActivityRows = db
    .prepare(
      `SELECT
         aa.action_type,
         aa.target_type,
         aa.created_at,
         u.username as admin_username
       FROM admin_actions aa
       JOIN users u ON u.id = aa.admin_id
       ORDER BY aa.created_at DESC
       LIMIT 20`
    )
    .all() as {
    action_type: string;
    target_type: string;
    created_at: string;
    admin_username: string;
  }[];

  const recentActivity = recentActivityRows.map((row) => ({
    action_type: row.action_type,
    target_type: row.target_type,
    created_at: row.created_at,
    admin_username: row.admin_username,
  }));

  return NextResponse.json({
    users: { total: userCount, approved: approvedCount, banned: bannedCount },
    waitlist: { pending: pendingWaitlistCount },
    studies: { total: studyCount, public: publicStudyCount, featured: featuredStudyCount },
    images: { total: imageCount },
    recentActivity,
  });
}
