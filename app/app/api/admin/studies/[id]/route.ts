import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';

const patchSchema = z.object({
  is_featured: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId)) {
    return NextResponse.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const study = db
    .prepare('SELECT id, title FROM studies WHERE id = ?')
    .get(studyId) as { id: number; title: string } | undefined;
  if (!study) {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 });
  }

  const { is_featured, is_public } = parsed.data;

  if (is_featured !== undefined) {
    db.prepare('UPDATE studies SET is_featured = ? WHERE id = ?').run(
      is_featured ? 1 : 0,
      studyId
    );
    logAdminAction({
      adminId: user.userId,
      actionType: is_featured ? 'feature_study' : 'unfeature_study',
      targetType: 'study',
      targetId: studyId,
      details: { title: study.title },
    });
  }

  if (is_public !== undefined) {
    db.prepare('UPDATE studies SET is_public = ? WHERE id = ?').run(
      is_public ? 1 : 0,
      studyId
    );
    logAdminAction({
      adminId: user.userId,
      actionType: is_public ? 'publish_study' : 'unpublish_study',
      targetType: 'study',
      targetId: studyId,
      details: { title: study.title },
    });
  }

  const updated = db
    .prepare('SELECT id, title, slug, is_public, is_featured FROM studies WHERE id = ?')
    .get(studyId);

  return NextResponse.json({ study: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId)) {
    return NextResponse.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  const db = getDb();
  const study = db
    .prepare('SELECT id, title FROM studies WHERE id = ?')
    .get(studyId) as { id: number; title: string } | undefined;
  if (!study) {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 });
  }

  // FK CASCADE covers: study_tags, annotations, favorites, study_images
  db.prepare('DELETE FROM studies WHERE id = ?').run(studyId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'delete_study',
    targetType: 'study',
    targetId: studyId,
    details: { title: study.title },
  });

  return NextResponse.json({ ok: true });
}
