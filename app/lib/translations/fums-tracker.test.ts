// app/lib/translations/fums-tracker.test.ts
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/connection", () => ({
  getDb: () => db,
}));

function seedSchema(d: Database.Database) {
  d.prepare(
    `CREATE TABLE fums_events (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       translation   TEXT NOT NULL,
       fums_token    TEXT,
       event_type    TEXT NOT NULL,
       study_id      INTEGER,
       user_id       INTEGER,
       verse_count   INTEGER NOT NULL,
       created_at    INTEGER NOT NULL,
       flushed_at    INTEGER,
       surface       TEXT    NOT NULL DEFAULT 'reader'
     )`,
  ).run();
}

describe("fums-tracker", () => {
  beforeEach(() => {
    db = new Database(":memory:");
    seedSchema(db);
    vi.resetModules();
  });
  afterEach(() => db.close());

  it("records fetch + display events", async () => {
    const { recordFumsEvent } = await import("./fums-tracker");
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "tok-1",
      eventType: "fetch",
      verseCount: 2,
    });
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "tok-1",
      eventType: "display",
      studyId: 5,
      userId: 7,
      verseCount: 2,
    });
    const rows = db
      .prepare(`SELECT event_type, verse_count FROM fums_events ORDER BY id`)
      .all() as Array<{ event_type: string; verse_count: number }>;
    expect(rows.map((r) => r.event_type)).toEqual(["fetch", "display"]);
  });

  it("flushFumsEvents is a no-op until the FUMS endpoint is wired", async () => {
    // Intentionally does NOT mark flushed_at. If the stub set flushed_at
    // locally, pre-existing rows would be silently dropped when the real
    // POST eventually lands — a compliance data-loss risk. See the
    // TODO(brief-13-followup) comment in fums-tracker.ts.
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");
    for (let i = 0; i < 3; i++) {
      recordFumsEvent({
        translation: "NIV",
        fumsToken: null,
        eventType: "display",
        verseCount: 1,
      });
    }
    const { flushed, attempted } = await flushFumsEvents();
    expect(flushed).toBe(0);
    expect(attempted).toBe(3);
    const unflushed = db
      .prepare(`SELECT COUNT(*) AS n FROM fums_events WHERE flushed_at IS NULL`)
      .get() as { n: number };
    expect(unflushed.n).toBe(3);
  });

  it("pruneOldFumsEvents deletes rows older than 13 months", async () => {
    const { pruneOldFumsEvents } = await import("./fums-tracker");
    const now = Math.floor(Date.now() / 1000);
    const thirteenMonths = 13 * 30 * 24 * 60 * 60;
    const old = now - thirteenMonths - 100;
    const fresh = now - 1000;
    db.prepare(
      `INSERT INTO fums_events (translation, event_type, verse_count, created_at) VALUES ('NIV','display',1,?)`,
    ).run(old);
    db.prepare(
      `INSERT INTO fums_events (translation, event_type, verse_count, created_at) VALUES ('NIV','display',1,?)`,
    ).run(fresh);
    const { deleted } = pruneOldFumsEvents();
    expect(deleted).toBe(1);
    const remaining = db
      .prepare(`SELECT COUNT(*) AS n FROM fums_events`)
      .get() as { n: number };
    expect(remaining.n).toBe(1);
  });
});
