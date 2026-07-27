-- 0003 — public-board consent and friend codes on userProfiles.

-- Defaulting to 0 unpublishes everyone currently on the leaderboard until
-- they opt in. Deliberate: nobody on it today was ever asked, so no existing
-- row represents real consent.
ALTER TABLE userProfiles ADD COLUMN leaderboardOptIn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE userProfiles ADD COLUMN leaderboardOptInAt TEXT;

-- Shareable friend code (Crockford base32 with the ambiguous letters removed;
-- rendered XXXX-XXXX). Minted on request for REGISTERED accounts only — an
-- anonymous identity can vanish with a cleared browser, leaving dead entries
-- in other people's friend lists.
ALTER TABLE userProfiles ADD COLUMN friendCode TEXT;

-- Partial unique index: most profiles have no code, but a code that exists
-- must resolve to exactly one person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_userProfiles_friendCode
  ON userProfiles(friendCode) WHERE friendCode IS NOT NULL;
