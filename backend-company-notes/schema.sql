-- Company map notes (Cloudflare D1). Apply with:
--   wrangler d1 execute company-notes --remote --file=schema.sql
-- One row per note. A note is anchored to one document. Notes are never deleted: done=1 folds them away.
CREATE TABLE IF NOT EXISTS notes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  doc      TEXT NOT NULL,             -- document id from the page's MAP data
  branch   TEXT NOT NULL,             -- top-level branch id
  author   TEXT NOT NULL,             -- Andy | Nick
  body     TEXT NOT NULL,
  created  TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  done_at  TEXT,
  seen     TEXT NOT NULL DEFAULT ''   -- comma list of names who have opened the document since
);
CREATE INDEX IF NOT EXISTS notes_doc ON notes(doc);
