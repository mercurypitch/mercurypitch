-- One-time cleanup for the move to a server-DERIVED leaderboard.
--
-- The leaderboardEntries table is no longer read or written: the worker now
-- computes rankings from sessionRecords (see workers/db-worker/src/index.ts,
-- handleLeaderboard). Its existing rows were self-reported by clients, so we
-- discard them ("wipe and start fresh"). Safe to run repeatedly.
--
-- Run once per environment AFTER deploying the new db-worker:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/wipe-leaderboard-entries.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/wipe-leaderboard-entries.sql
--
-- (The table itself is intentionally left in place — dropping it would require
-- a migration and it's harmless empty. It can be dropped in a later cleanup.)

DELETE FROM leaderboardEntries;
