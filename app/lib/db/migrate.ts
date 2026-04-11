// app/lib/db/migrate.ts
import { closeDb, getDb } from './connection';

function main() {
  console.log('Running migration...\n');

  const db = getDb();

  // Print all tables
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as { name: string }[];
  console.log('Tables created:');
  tables.forEach((t) => console.log(`  - ${t.name}`));

  // Print seeded categories
  const categories = db
    .prepare('SELECT id, name, slug FROM categories ORDER BY sort_order')
    .all() as { id: number; name: string; slug: string }[];
  console.log('\nSeeded categories:');
  categories.forEach((c) => console.log(`  [${c.id}] ${c.name} (${c.slug})`));

  // Print schema version
  const version = db
    .prepare('SELECT MAX(version) as version FROM schema_migrations')
    .get() as { version: number };
  console.log(`\nSchema version: ${version.version}`);

  closeDb();
  console.log('\nDone.');
}

main();
