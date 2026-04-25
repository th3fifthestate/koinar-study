#!/usr/bin/env tsx
/**
 * Re-runs the entity-annotation pipeline against existing studies so the
 * AMBIGUOUS_NAMES expansion + idiom dictionary + idiom-skip changes take
 * effect on already-published content. Idempotent.
 *
 *   npx tsx scripts/rescan-annotations.ts                 # dry-run, prints diff
 *   npx tsx scripts/rescan-annotations.ts --commit        # apply
 *   npx tsx scripts/rescan-annotations.ts --ids=1,5,9     # filter by study id
 *
 * Safety:
 *   - Studies whose annotations include any `ai_generation` row are SKIPPED
 *     entirely. AI-generated annotations are sacrosanct and never
 *     overwritten by this script.
 *   - Only `render_fallback` rows are deleted + recomputed.
 *   - On --commit, the rescan happens inside a single transaction per study
 *     so a crash mid-run leaves rows consistent.
 */

import 'dotenv/config';
import { getDb } from '../lib/db/connection';
import {
  computeAnnotationsForContent,
} from '../lib/entities/annotator';
import {
  getAnnotationsForStudy,
  insertStudyAnnotations,
  deleteAnnotationsForStudy,
} from '../lib/db/entities/queries';
import type { Study, StudyEntityAnnotation } from '../lib/db/types';

const argv = new Set(process.argv.slice(2));
const COMMIT = argv.has('--commit');
const idsArg = process.argv.slice(2).find(a => a.startsWith('--ids='));
const ONLY_IDS = idsArg
  ? new Set(idsArg.slice('--ids='.length).split(',').map(s => parseInt(s, 10)))
  : null;

type StudyRow = Pick<Study, 'id' | 'title' | 'content_markdown'>;

function diffAnnotations(
  before: StudyEntityAnnotation[],
  after: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[]
): { added: string[]; removed: string[]; kept: string[] } {
  const beforeIds = new Set(before.map(a => a.entity_id));
  const afterIds = new Set(after.map(a => a.entity_id));
  const added = [...afterIds].filter(id => !beforeIds.has(id));
  const removed = [...beforeIds].filter(id => !afterIds.has(id));
  const kept = [...afterIds].filter(id => beforeIds.has(id));
  return { added, removed, kept };
}

async function main(): Promise<void> {
  const db = getDb();

  // All studies, with their content. We'll filter ai_generation guarded ones
  // in the loop so the diagnostic output reports them clearly.
  const studies = db
    .prepare<[], StudyRow>(
      'SELECT id, title, content_markdown FROM studies ORDER BY id'
    )
    .all();

  let inspected = 0;
  let skippedAi = 0;
  let skippedFiltered = 0;
  let unchanged = 0;
  let willChange = 0;
  let totalAdds = 0;
  let totalRemoves = 0;

  console.log(
    `Inspecting ${studies.length} studies${COMMIT ? ' (COMMIT MODE)' : ' (dry-run)'}` +
    `${ONLY_IDS ? `, filtering to ids: ${[...ONLY_IDS].join(',')}` : ''}\n`
  );

  for (const study of studies) {
    if (ONLY_IDS && !ONLY_IDS.has(study.id)) {
      skippedFiltered++;
      continue;
    }
    inspected++;

    const before = getAnnotationsForStudy(study.id);
    const hasAi = before.some(a => a.annotation_source === 'ai_generation');
    if (hasAi) {
      skippedAi++;
      console.log(`  [${study.id}] "${study.title.slice(0, 50)}" — has ai_generation rows, SKIP`);
      continue;
    }

    const { annotations: after } = computeAnnotationsForContent(
      study.id,
      study.content_markdown
    );

    const diff = diffAnnotations(before, after);

    if (diff.added.length === 0 && diff.removed.length === 0) {
      unchanged++;
      console.log(`  [${study.id}] "${study.title.slice(0, 50)}" — ${before.length} unchanged`);
      continue;
    }

    willChange++;
    totalAdds += diff.added.length;
    totalRemoves += diff.removed.length;

    console.log(
      `  [${study.id}] "${study.title.slice(0, 50)}" — ${before.length} → ${after.length}` +
      `  (+${diff.added.length} -${diff.removed.length})`
    );
    if (diff.added.length > 0) {
      console.log(`        + added:   ${diff.added.slice(0, 8).join(', ')}${diff.added.length > 8 ? `, … +${diff.added.length - 8} more` : ''}`);
    }
    if (diff.removed.length > 0) {
      console.log(`        - removed: ${diff.removed.slice(0, 8).join(', ')}${diff.removed.length > 8 ? `, … +${diff.removed.length - 8} more` : ''}`);
    }

    if (COMMIT) {
      // Per-study transaction: delete fallback rows, insert new.
      db.transaction(() => {
        deleteAnnotationsForStudy(study.id);
        if (after.length > 0) insertStudyAnnotations(after);
      })();
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Studies inspected:        ${inspected}`);
  console.log(`Skipped (ai_generation):  ${skippedAi}`);
  if (ONLY_IDS) console.log(`Skipped (id filter):      ${skippedFiltered}`);
  console.log(`Unchanged:                ${unchanged}`);
  console.log(`Changed:                  ${willChange}`);
  console.log(`Total entity adds:        ${totalAdds}`);
  console.log(`Total entity removes:     ${totalRemoves}`);

  if (!COMMIT && willChange > 0) {
    console.log('\n(DRY RUN — re-run with --commit to apply)\n');
  } else if (COMMIT) {
    console.log('\n✓ Applied.\n');
  }
}

main().catch(err => {
  console.error('Rescan failed:', err);
  process.exit(1);
});
