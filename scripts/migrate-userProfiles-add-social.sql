-- Migration: leaderboard opt-in + friend codes on userProfiles.
--
-- schema.sql declares userProfiles with `CREATE TABLE IF NOT EXISTS`, so these
-- columns are never added to a table that already exists — run this once per
-- environment that predates them.
--
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-userProfiles-add-social.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-userProfiles-add-social.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; these error (harmlessly) if
-- the columns already exist. Fresh databases get them from schema.sql.

-- Public-board consent. Defaulting to 0 means the switch to an opt-in board
-- unpublishes everyone currently on it — deliberate: nobody on the board today
-- was ever asked, so no existing row represents real consent.
ALTER TABLE userProfiles ADD COLUMN leaderboardOptIn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE userProfiles ADD COLUMN leaderboardOptInAt TEXT;

-- Shareable friend code, minted on request for registered accounts only.
ALTER TABLE userProfiles ADD COLUMN friendCode TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_userProfiles_friendCode
  ON userProfiles(friendCode) WHERE friendCode IS NOT NULL;
