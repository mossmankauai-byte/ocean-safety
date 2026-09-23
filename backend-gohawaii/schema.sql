-- GoHawaii backend (Cloudflare D1). Apply with:
--   wrangler d1 execute gohawaii --remote --file=schema.sql
-- Nothing here stores a person. counts holds totals per Hawaiʻi calendar day; docs holds what staff
-- publish (posts and place changes); staff holds a SHA-256 of each sign-in key, never the key.

CREATE TABLE IF NOT EXISTS counts (
  day    TEXT NOT NULL,             -- yyyy-mm-dd, Hawaiʻi time
  island TEXT NOT NULL,             -- kauai | oahu | maui | hawaii
  metric TEXT NOT NULL,             -- visit | tab | beach | place | link | adv | lang | dev | hour
  k      TEXT NOT NULL DEFAULT '',  -- what was counted (a beach id, a tab name, a language)
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, island, metric, k)
);

CREATE TABLE IF NOT EXISTS docs (
  name       TEXT PRIMARY KEY,      -- notices | places:kauai | places:oahu | places:maui | places:hawaii
  body       TEXT NOT NULL,
  ver        INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  key_hash TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL,           -- Editor | Approver
  org      TEXT NOT NULL,           -- state | kauai | oahu | maui | hawaii
  active   INTEGER NOT NULL DEFAULT 1,
  created  TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  at    TEXT NOT NULL,
  who   TEXT NOT NULL,
  org   TEXT NOT NULL,
  what  TEXT NOT NULL,
  doc   TEXT,
  ref   TEXT
);
