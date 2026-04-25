#!/usr/bin/env tsx
/**
 * Smoke check for the entity-drawer data path.
 *
 * Calls getEntityDetail() against the real DB for a handful of entities that
 * had relationship-direction bugs and prints what the drawer would render.
 * Verifies:
 *   - No duplicate cards (one per pair, not two).
 *   - `displayed_label` reads correctly from the current entity's voice.
 *   - No stale "parent of" on the to-side when the entity is actually the child.
 *
 * Not a vitest test — it exercises the live prod DB, so runs as a script.
 * Run:  npx tsx scripts/smoke-entity-drawer.ts
 */

import 'dotenv/config';
import { getEntityDetail } from '../lib/db/entities/queries';

const ENTITIES_TO_CHECK = [
  // Family case from the original bug report
  'MATTHEW_G3156',
  'MARY_G3137K',
  'ALPHAEUS_G0256',
  // Family with lots of edges (sanity: not duplicated)
  'DAVID_H1732G',
  'JACOB_H3290G',
  // Asymmetric geography
  'BETHLEHEM',
  'JUDEA_REGION',
  'JERUSALEM',
  // Asymmetric temporal
  'PATRIARCHAL_PERIOD',
  'BABYLONIAN_PERIOD',
  // Asymmetric group
  'TRIBE_OF_JUDAH',
  'TWELVE_TRIBES',
  // HEROD — was the self-loop entity
  'HEROD_G2264H',
];

function main() {
  for (const id of ENTITIES_TO_CHECK) {
    const detail = getEntityDetail(id);
    if (!detail) {
      console.log(`[${id}] — NOT FOUND`);
      continue;
    }
    console.log(`\n[${id}] ${detail.canonical_name}  (${detail.entity_type})`);
    console.log(`  ${detail.relationships.length} relationship rows:`);

    // Group by related entity to catch dupes.
    const byRelated = new Map<string, typeof detail.relationships>();
    for (const r of detail.relationships) {
      const relatedId = r.from_entity_id === id ? r.to_entity_id : r.from_entity_id;
      const list = byRelated.get(relatedId) ?? [];
      list.push(r);
      byRelated.set(relatedId, list);
    }

    for (const [relatedId, rows] of byRelated) {
      if (rows.length > 1) {
        console.log(`    ⚠️ DUPLICATE — ${rows.length} cards for ${relatedId}:`);
        for (const r of rows) {
          console.log(`        · ${r.relationship_type}  displayed="${r.displayed_label}"  raw="${r.relationship_label}"  (side=${r.from_entity_id === id ? 'from' : 'to'})`);
        }
      } else {
        const r = rows[0]!;
        const side = r.from_entity_id === id ? 'from' : 'to';
        console.log(`    · ${r.related_entity_name.padEnd(24)} "${r.displayed_label}"  [${r.relationship_type}, ${side}]`);
      }
    }
  }
}

main();
