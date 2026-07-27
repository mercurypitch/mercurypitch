-- Migration: add sessionRecords.source to pre-existing databases.
--
-- Records what kind of attempt a row was — 'practice' (free singing),
-- 'challenge', 'weekly' or 'exercise'. The leaderboard ranks only fixed
-- tasks (see leaderboardConfig.eligibleSources): comparing averaged scores
-- across arbitrary melodies of arbitrary difficulty is not meaningful, so
-- free practice is excluded from public ranking.
--
-- schema.sql declares sessionRecords with `CREATE TABLE IF NOT EXISTS`, so
-- this column is never added to a table that already exists — run this once
-- per environment that predates it.
--
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-sessionRecords-add-source.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-sessionRecords-add-source.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; this errors (harmlessly) if
-- the column already exists. Fresh databases get it from schema.sql.

ALTER TABLE sessionRecords ADD COLUMN source TEXT NOT NULL DEFAULT 'practice';
CREATE INDEX IF NOT EXISTS idx_sessionRecords_source ON sessionRecords(source);

-- Backfill from the only signals older rows carry: the weekly tag, and the
-- melodyName prefixes the two challenge writers have always used
-- ("Challenge: <title>" / "Legend: <title>"). Everything else was free
-- practice. Exercises never wrote session records at all, so none exist.
UPDATE sessionRecords SET source = 'weekly'
  WHERE weeklyChallengeId IS NOT NULL AND weeklyChallengeId <> '';

UPDATE sessionRecords SET source = 'challenge'
  WHERE source = 'practice' AND melodyName LIKE 'Challenge: %';

UPDATE sessionRecords SET source = 'weekly'
  WHERE source = 'practice' AND melodyName LIKE 'Legend: %';
