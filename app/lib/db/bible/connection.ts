import Database from "better-sqlite3";
import { config } from "@/lib/config";

let bsbDb: Database.Database | null = null;
let hebrewGreekDb: Database.Database | null = null;
let strongsDb: Database.Database | null = null;
let crossRefsDb: Database.Database | null = null;

function openReadOnly(dbPath: string): Database.Database {
  const db = new Database(dbPath, { readonly: true });
  db.pragma("cache_size = -10000"); // 10MB cache
  db.pragma("temp_store = MEMORY");
  return db;
}

export function getBsbDb(): Database.Database {
  if (!bsbDb) {
    bsbDb = openReadOnly(config.db.bsb);
  }
  return bsbDb;
}

export function getHebrewGreekDb(): Database.Database {
  if (!hebrewGreekDb) {
    hebrewGreekDb = openReadOnly(config.db.hebrewGreek);
  }
  return hebrewGreekDb;
}

export function getStrongsDb(): Database.Database {
  if (!strongsDb) {
    strongsDb = openReadOnly(config.db.strongs);
  }
  return strongsDb;
}

export function getCrossRefsDb(): Database.Database {
  if (!crossRefsDb) {
    crossRefsDb = openReadOnly(config.db.crossRefs);
  }
  return crossRefsDb;
}
