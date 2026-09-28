-- RevenueCat sandbox events on production (src/revenuecat-sandbox.ts): one
-- row for every sandbox period grant that gave songs, with the UTC day it was
-- made on. The day's budget (REVENUECAT_SANDBOX_DAILY_SONGS) is the sum of a
-- day's rows, checked in the same batch that writes the grant and its row, so
-- it never scans the ledger. A row names no account, only the id of the
-- ledger row it was written with, so deleting an account does not give its
-- songs back to the day's budget.
CREATE TABLE IF NOT EXISTS revenuecatSandboxGrants (
  grantId TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  songs INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revenuecatSandboxGrants_day
  ON revenuecatSandboxGrants(day);
