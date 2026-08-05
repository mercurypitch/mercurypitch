-- Editable demo song for the Karaoke Night page.
--
-- The demo used to live only in public/karaoke-demo-song.json, so changing
-- the song — or fixing one wrong lyric line — meant shipping a build. This
-- table is the override layer: the client reads it first and falls back to
-- the shipped manifest whenever there is no row, no API, or a bad row. The
-- manifest therefore stays the floor and the demo can never be broken by
-- an outage or a typo in the studio.
--
-- Keyed by `slug` rather than a singleton row so a second demo surface can
-- be added later without another migration.
--
-- `lyricsRevision` exists because seeding is deliberately non-destructive:
-- the client never overwrites a visitor's own edits under the demo session
-- id. That is right for their edits and wrong for an authored correction,
-- so the client re-seeds when this number moves and the local copy is not
-- dirty. Bump it whenever lyricsText or lyricsUrl changes.

CREATE TABLE IF NOT EXISTS demoSongs (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  attributionText TEXT NOT NULL DEFAULT '',
  attributionUrl TEXT NOT NULL DEFAULT '',
  licenseName TEXT NOT NULL DEFAULT '',
  licenseUrl TEXT NOT NULL DEFAULT '',
  vocalUrl TEXT,
  instrumentalUrl TEXT,
  -- Either a URL to fetch, or pasted LRC/plain text. Text wins when both
  -- are set, so a quick correction never needs a re-upload to R2.
  lyricsUrl TEXT,
  lyricsText TEXT,
  lyricsRevision INTEGER NOT NULL DEFAULT 1,
  durationSec INTEGER,
  -- A row can be parked without deleting it; the client then falls back to
  -- the shipped manifest exactly as if the row were absent.
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_demoSongs_active ON demoSongs(active, slug);
