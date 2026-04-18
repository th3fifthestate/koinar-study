import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';

let seeded = false;

beforeAll(() => {
  try {
    const { getDb } = require('../connection');
    const db = getDb() as import('better-sqlite3').Database;
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
    const { getCrossRefsFor } = require('./queries');
    const refs = getCrossRefsFor('Genesis', 1, 1);
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBeGreaterThanOrEqual(5);
  });

  skip('returns at least 10 refs for John 3:16', () => {
    const { getCrossRefsFor } = require('./queries');
    const refs = getCrossRefsFor('John', 3, 16);
    expect(refs.length).toBeGreaterThanOrEqual(10);
  });

  skip('returns [] for a non-existent verse', () => {
    const { getCrossRefsFor } = require('./queries');
    const refs = getCrossRefsFor('nope', 999, 999);
    expect(refs).toEqual([]);
  });

  skip('orders higher-votes refs first when votes are present', () => {
    const { getCrossRefsFor } = require('./queries');
    // John 3:16 is one of the most cross-referenced verses; votes should be meaningful
    const refs = getCrossRefsFor('John', 3, 16);
    const withVotes = refs.filter((r: { votes: number | null }) => r.votes !== null);
    if (withVotes.length >= 2) {
      for (let i = 1; i < withVotes.length; i++) {
        expect(withVotes[i].votes).toBeLessThanOrEqual(withVotes[i - 1].votes);
      }
    }
  });

  skip('returns at most 50 refs', () => {
    const { getCrossRefsFor } = require('./queries');
    const refs = getCrossRefsFor('Genesis', 1, 1);
    expect(refs.length).toBeLessThanOrEqual(50);
  });
});
