-- 0017_user_suspension.sql — reversible account suspension with audit history.
--
-- Suspension is an access-control state, not deletion. The current state lives
-- on users for the hot authentication path; every real state transition is
-- copied to an internal append-only audit table. Restoring an account clears
-- the current state but does not roll tokenVersion back, so a token revoked by
-- suspension can never become valid again.

ALTER TABLE users ADD COLUMN suspendedAt TEXT;
ALTER TABLE users ADD COLUMN suspensionReason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_suspendedAt
  ON users(suspendedAt) WHERE suspendedAt IS NOT NULL;

CREATE TABLE IF NOT EXISTS userModerationEvents (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('suspend', 'restore')),
  reason TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_userModerationEvents_user_created
  ON userModerationEvents(userId, createdAt DESC);
