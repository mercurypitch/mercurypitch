-- 0011_userActivity.sql — the things a singer DID, for their own profile.
--
-- The profile can already show scores, because sessionRecords carries
-- them. It cannot say "made four playlists" or "sang one start to finish",
-- because nothing records an act that leaves no practice session behind.
--
-- Deliberately NOT mirrorEvents. That table is the marketing funnel: keyed
-- by clientId (a device, not a person), written by the landing pages, and
-- read from the ops console rather than the app. Showing someone their own
-- history from it would be wrong on their second device and unqueryable
-- from the client. Product metrics and growth analytics answer different
-- questions and outlive each other; they get different tables.
--
-- One append-only row per act, with `kind` from a small closed union, so a
-- new metric is a new kind rather than a new migration. Anything derivable
-- from sessionRecords stays there: this is only for acts that leave no
-- session behind (see docs/agent/CONVENTIONS.md on one source of truth).

CREATE TABLE IF NOT EXISTS userActivity (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  -- 'playlist_created' | 'playlist_completed' | 'song_completed'
  -- | 'stems_separated' | 'melody_created' | 'ascent_week_completed'
  kind TEXT NOT NULL,
  -- The thing acted on (a playlist id, a session id), when there is one.
  -- Not a foreign key: the row outlives what it points at on purpose — a
  -- deleted playlist does not un-make the act of having made it.
  refId TEXT,
  -- JSON, per-kind detail (song count, duration). Free-form so a kind can
  -- gain a field without a migration; never queried structurally.
  metaJson TEXT,
  -- When it happened, which is not always when it synced.
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_userActivity_userId ON userActivity(userId);
-- The profile query is "my acts, by kind": this covers it in one index.
CREATE INDEX IF NOT EXISTS idx_userActivity_userId_kind
  ON userActivity(userId, kind);
