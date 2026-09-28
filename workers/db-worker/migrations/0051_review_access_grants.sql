-- Play review access (src/review-access.ts): one row for every grant ever
-- made. The route's bound on how many accounts the deployment ever grants
-- counts these rows, not the ledger's: deleting an account deletes its
-- ledger rows (USER_OWNED_TABLES in auth.ts), which gave its place back
-- (review of PR 882, finding 3). A row names no account, only the id of the
-- ledger row it was written with, so it is nobody's data and stays when the
-- account goes. The count is of this table alone, a few rows at most, never
-- a scan of the ledger.
CREATE TABLE IF NOT EXISTS reviewAccessGrants (
  grantId TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL
);

-- Grants made before this table existed.
INSERT OR IGNORE INTO reviewAccessGrants (grantId, createdAt)
  SELECT id, createdAt FROM creditLedger WHERE reason = 'review-access';
