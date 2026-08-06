-- 0020_managed_testing_accounts.sql — development testing identities.
--
-- The tables are safe in every environment, but the provisioning route is
-- enabled only by ALLOW_TEST_ACCOUNT_PROVISIONING=1 (dev). Synthetic grants
-- stay in the environment-local DB; they never enter the shared PERKS_DB.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS managedTestAccounts (
  userId TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  testerId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  revokedAt TEXT,
  creditAllowance INTEGER NOT NULL DEFAULT 0,
  supporterEnabled BOOLEAN NOT NULL DEFAULT 0,
  perksJson TEXT NOT NULL DEFAULT '[]',
  grantRevision INTEGER NOT NULL DEFAULT 1,
  UNIQUE (campaignId, testerId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (creditAllowance >= 0),
  CHECK (supporterEnabled IN (0, 1)),
  CHECK (json_valid(perksJson))
);

CREATE INDEX IF NOT EXISTS idx_managedTestAccounts_expiry
  ON managedTestAccounts (expiresAt, revokedAt);

CREATE TABLE IF NOT EXISTS managedTestAccountPerks (
  userId TEXT NOT NULL,
  perkId TEXT NOT NULL,
  grantedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  PRIMARY KEY (userId, perkId),
  FOREIGN KEY (userId) REFERENCES managedTestAccounts(userId)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_managedTestAccountPerks_active
  ON managedTestAccountPerks (userId, expiresAt);
