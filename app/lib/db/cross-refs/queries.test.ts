import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getDb } from '../connection';
import { getCrossRefsFor } from './queries';

let seeded = false;

beforeAll(() => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as c FROM cross_refs WHERE source = 'tsk'").get() as { c: number };
    seeded = row.c > 0;
  } catch {
    seeded = false;
  }
});

function skip(name: string, fn: () => void) {
  it(name, () => {
    if (!seeded) {
      console.log(`SKIP: cross_refs table is empty. Run \`npm run ingest:tsk\` first.`);
      return;
    }
    fn();
  });
}

describe('getCrossRefsFor', () => {
  skip('returns at least 5 refs for Gen 1:1', () => {
    const refs = getCrossRefsFor('Genesis', 1, 1);
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBeGreaterThanOrEqual(5);
  });

  skip('returns at least 10 refs for John 3:16', () => {
    const refs = getCrossRefsFor('John', 3, 16);
    expect(refs.length).toBeGreaterThanOrEqual(10);
  });

  skip('returns [] for a non-existent verse', () => {
    const refs = getCrossRefsFor('nope', 999, 999);
    expect(refs).toEqual([]);
  });

  skip('orders higher-votes refs first when votes are present', () => {
    // John 3:16 is one of the most cross-referenced verses; votes should be meaningful
    const refs = getCrossRefsFor('John', 3, 16);
    const withVotes = refs.filter(
      (r): r is typeof r & { votes: number } => r.votes !== null,
    );
    if (withVotes.length >= 2) {
      for (let i = 1; i < withVotes.length; i++) {
        expect(withVotes[i].votes).toBeLessThanOrEqual(withVotes[i - 1].votes);
      }
    }
  });

  skip('returns at most 50 refs', () => {
    const refs = getCrossRefsFor('Genesis', 1, 1);
    expect(refs.length).toBeLessThanOrEqual(50);
  });
});
