// app/lib/translations/fums-tracker.test.ts
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/connection", () => ({
  getDb: () => db,
}));

// Provide a deterministic salt so hashFumsUserId emits a stable uId during tests.
// Keep isolated from the real env — config module reads env at import time, so
// we also mock the consumer directly below.
vi.mock("@/lib/config", () => ({
  config: {
    bible: {
      fumsUidSalt: "test-salt-exactly-32-chars-minimum!",
      retention: { fumsEventMonths: 13 },
    },
  },
}));

function seedSchema(d: Database.Database) {
  d.prepare(
    `CREATE TABLE fums_events (
       id               INTEGER PRIMARY KEY AUTOINCREMENT,
       translation      TEXT NOT NULL,
       fums_token       TEXT,
       event_type       TEXT NOT NULL,
       study_id         INTEGER,
       user_id          INTEGER,
       verse_count      INTEGER NOT NULL,
       created_at       INTEGER NOT NULL,
       flushed_at       INTEGER,
       surface          TEXT    NOT NULL DEFAULT 'reader',
       session_id       TEXT,
       flush_attempts   INTEGER NOT NULL DEFAULT 0,
       flush_last_error TEXT
     )`,
  ).run();
  d.prepare(
    `CREATE TABLE app_config (
       key         TEXT PRIMARY KEY,
       value       TEXT NOT NULL,
       updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  ).run();
}

describe("fums-tracker", () => {
  beforeEach(() => {
    db = new Database(":memory:");
    seedSchema(db);
    vi.resetModules();
  });
  afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
  });

  it("records fetch + display events (persists session_id)", async () => {
    const { recordFumsEvent } = await import("./fums-tracker");
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "tok-1",
      eventType: "fetch",
      verseCount: 2,
      surface: { kind: 'reader', studyId: 'study-1' },
      sessionId: "sess-aaa",
    });
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "tok-1",
      eventType: "display",
      studyId: 5,
      userId: 7,
      verseCount: 2,
      surface: { kind: 'reader', studyId: '5' },
      sessionId: null,
    });
    const rows = db
      .prepare(
        `SELECT event_type, verse_count, session_id FROM fums_events ORDER BY id`,
      )
      .all() as Array<{ event_type: string; verse_count: number; session_id: string | null }>;
    expect(rows.map((r) => r.event_type)).toEqual(["fetch", "display"]);
    expect(rows[0].session_id).toBe("sess-aaa");
    expect(rows[1].session_id).toBeNull();
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

describe("flushFumsEvents", () => {
  beforeEach(() => {
    db = new Database(":memory:");
    seedSchema(db);
    vi.resetModules();
  });
  afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
  });

  it("skips tokenless (display-only) rows — they're audit-only and drain via prune", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");
    for (let i = 0; i < 3; i++) {
      recordFumsEvent({
        translation: "NIV",
        fumsToken: null,
        eventType: "display",
        verseCount: 1,
        surface: { kind: 'reader', studyId: 'study-1' },
      });
    }
    const { flushed, attempted } = await flushFumsEvents();
    expect(flushed).toBe(0);
    expect(attempted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const unflushed = db
      .prepare(`SELECT COUNT(*) AS n FROM fums_events WHERE flushed_at IS NULL`)
      .get() as { n: number };
    expect(unflushed.n).toBe(3);
  });

  it("on 2xx, marks all rows in the batch flushed_at and emits dId/sId/t params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x47, 0x49, 0x46]), {
        status: 200,
        headers: { "content-type": "image/gif" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");

    for (let i = 0; i < 3; i++) {
      recordFumsEvent({
        translation: "NIV",
        fumsToken: `tok-${i}`,
        eventType: "fetch",
        userId: 42,
        verseCount: 1,
        surface: { kind: 'reader', studyId: 'study-1' },
        sessionId: "sess-A",
      });
    }

    const { flushed, attempted } = await flushFumsEvents();
    expect(flushed).toBe(3);
    expect(attempted).toBe(3);

    const flushedRows = db
      .prepare(
        `SELECT COUNT(*) AS n FROM fums_events WHERE flushed_at IS NOT NULL`,
      )
      .get() as { n: number };
    expect(flushedRows.n).toBe(3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://fums.api.bible/f3");
    expect(url.searchParams.getAll("t")).toEqual(["tok-0", "tok-1", "tok-2"]);
    expect(url.searchParams.get("sId")).toBe("sess-A");
    expect(url.searchParams.get("dId")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // uId present when FUMS_UID_SALT is set (our test mock provides one)
    const uId = url.searchParams.get("uId");
    expect(uId).not.toBeNull();
    expect(uId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("on non-2xx, leaves rows unflushed, increments flush_attempts, stores flush_last_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");

    recordFumsEvent({
      translation: "NIV",
      fumsToken: "tok-fail",
      eventType: "fetch",
      userId: 1,
      verseCount: 1,
      surface: { kind: 'reader', studyId: 'study-1' },
      sessionId: "sess-A",
    });

    const { flushed, attempted } = await flushFumsEvents();
    expect(flushed).toBe(0);
    expect(attempted).toBe(1);

    const row = db
      .prepare(
        `SELECT flushed_at, flush_attempts, flush_last_error FROM fums_events WHERE fums_token = 'tok-fail'`,
      )
      .get() as {
        flushed_at: number | null;
        flush_attempts: number;
        flush_last_error: string | null;
      };
    expect(row.flushed_at).toBeNull();
    expect(row.flush_attempts).toBe(1);
    expect(row.flush_last_error).toContain("500");
  });

  it("quarantines rows at flush_attempts >= 10 (skips them on subsequent runs)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { flushFumsEvents } = await import("./fums-tracker");

    db.prepare(
      `INSERT INTO fums_events
         (translation, fums_token, event_type, verse_count, created_at, session_id, flush_attempts)
       VALUES ('NIV','tok-quarantined','fetch',1,?, 'sess-A', 10)`,
    ).run(Math.floor(Date.now() / 1000));

    const { flushed, attempted } = await flushFumsEvents();
    expect(flushed).toBe(0);
    expect(attempted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("groups rows by (sessionId, userId) and issues one GET per group", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");

    recordFumsEvent({
      translation: "NIV",
      fumsToken: "a1",
      eventType: "fetch",
      userId: 1,
      verseCount: 1,
      surface: { kind: 'reader', studyId: 's' },
      sessionId: "sess-A",
    });
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "a2",
      eventType: "fetch",
      userId: 1,
      verseCount: 1,
      surface: { kind: 'reader', studyId: 's' },
      sessionId: "sess-A",
    });
    recordFumsEvent({
      translation: "NIV",
      fumsToken: "b1",
      eventType: "fetch",
      userId: 2,
      verseCount: 1,
      surface: { kind: 'reader', studyId: 's' },
      sessionId: "sess-B",
    });

    await flushFumsEvents();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((call) => new URL(call[0] as string));
    const byGroup = new Map(
      urls.map((u) => [u.searchParams.get("sId") ?? "", u.searchParams.getAll("t")]),
    );
    expect(byGroup.get("sess-A")).toEqual(["a1", "a2"]);
    expect(byGroup.get("sess-B")).toEqual(["b1"]);
  });

  it("buckets null-session rows under 'cron' so background events still ship", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");

    recordFumsEvent({
      translation: "NIV",
      fumsToken: "cron-1",
      eventType: "fetch",
      verseCount: 1,
      surface: { kind: 'reader', studyId: 'system:renew-cache' },
    });

    const { flushed } = await flushFumsEvents();
    expect(flushed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("sId")).toBe("cron");
  });

  it("chunks groups larger than TOKENS_PER_REQUEST (40) across multiple GETs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { recordFumsEvent, flushFumsEvents } = await import("./fums-tracker");

    // 85 tokens in the same (sessionId, userId) bucket → ceil(85/40) = 3 GETs.
    for (let i = 0; i < 85; i++) {
      recordFumsEvent({
        translation: "NIV",
        fumsToken: `tok-${i}`,
        eventType: "fetch",
        userId: 99,
        verseCount: 1,
        surface: { kind: 'reader', studyId: 's' },
        sessionId: "big-sess",
      });
    }

    const { flushed, attempted } = await flushFumsEvents(200);
    expect(attempted).toBe(85);
    expect(flushed).toBe(85);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const tokenCounts = fetchMock.mock.calls.map((call) => {
      const u = new URL(call[0] as string);
      return u.searchParams.getAll("t").length;
    });
    expect(tokenCounts).toEqual([40, 40, 5]);
  });
});

describe('surface field', () => {
  beforeEach(() => {
    db = new Database(':memory:');
    seedSchema(db);
    vi.resetModules();
  });
  afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
  });

  it('stores surface=reader for reader events', async () => {
    const { recordFumsEvent } = await import('./fums-tracker');
    recordFumsEvent({
      translation: 'NIV',
      fumsToken: null,
      eventType: 'display',
      verseCount: 1,
      surface: { kind: 'reader', studyId: 'study-1' },
    });
    const row = db
      .prepare('SELECT surface FROM fums_events ORDER BY id DESC LIMIT 1')
      .get() as { surface: string };
    expect(row.surface).toBe('reader');
  });

  it('stores surface as bench:board-1 for bench events', async () => {
    const { recordFumsEvent } = await import('./fums-tracker');
    recordFumsEvent({
      translation: 'NIV',
      fumsToken: null,
      eventType: 'display',
      verseCount: 1,
      surface: { kind: 'bench', boardId: 'board-1' },
    });
    const row = db
      .prepare('SELECT surface FROM fums_events ORDER BY id DESC LIMIT 1')
      .get() as { surface: string };
    expect(row.surface).toBe('bench:board-1');
  });
});
