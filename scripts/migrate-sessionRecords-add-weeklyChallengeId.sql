-- Migration: add sessionRecords.weeklyChallengeId to pre-existing databases.
--
-- Tags a practice attempt to a weekly "Sing the Legend" challenge so the
-- weekly board (/api/weekly/board) can aggregate best-per-user. NULL for
-- ordinary practice. schema.sql declares sessionRecords with
-- `CREATE TABLE IF NOT EXISTS`, so this column is never added to a table that
-- already exists — run this once per environment that predates it.
--
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-sessionRecords-add-weeklyChallengeId.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-sessionRecords-add-weeklyChallengeId.sql
--
-- The weeklyChallenges TABLE itself is created by schema.sql on the next
-- deploy (CREATE TABLE IF NOT EXISTS), so it needs no migration.
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; this errors (harmlessly) if
-- the column already exists. Fresh databases get it from schema.sql.

ALTER TABLE sessionRecords ADD COLUMN weeklyChallengeId TEXT;
CREATE INDEX IF NOT EXISTS idx_sessionRecords_weekly ON sessionRecords(weeklyChallengeId);
