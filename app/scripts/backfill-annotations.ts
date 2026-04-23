// app/scripts/backfill-annotations.ts
// Run with: npm run backfill:annotations

import 'dotenv/config';
import { getDb } from '../lib/db/connection';
import { annotateStudyIfNeeded } from '../lib/entities/annotator';
import type { Study } from '../lib/db/types';

async function main(): Promise<void> {
  const db = getDb();

  // Studies with no rows in study_entity_annotations
  const studiesWithoutAnnotations = db
    .prepare(
      `SELECT s.* FROM studies s
       LEFT JOIN study_entity_annotations a ON a.study_id = s.id
       WHERE a.id IS NULL`
    )
    .all() as Study[];

  const total = studiesWithoutAnnotations.length;
  console.log(`Found ${total} studies without entity annotations.\n`);

  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  let totalAnnotations = 0;
  let zeroMatches = 0;

  for (let i = 0; i < studiesWithoutAnnotations.length; i++) {
    const study = studiesWithoutAnnotations[i];
    const annotations = await annotateStudyIfNeeded(study.id, study.content_markdown);

    if (annotations.length === 0) zeroMatches++;
    totalAnnotations += annotations.length;

    const label = study.title.slice(0, 60);
    console.log(`[${i + 1}/${total}] "${label}" — ${annotations.length} entities found`);
  }

  console.log('\n=== Summary ===');
  console.log(`Studies processed:         ${total}`);
  console.log(`Total annotations created: ${totalAnnotations}`);
  console.log(`Studies with zero matches: ${zeroMatches}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
