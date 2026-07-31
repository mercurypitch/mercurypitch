-- 0008_passwordResets.sql — single-use password-reset tokens (PR #372),
-- converted from that PR's ad-hoc script into the tracked chain. Only the
-- SHA-256 of a token is stored; rows are consumed on use and superseded
-- per user on re-request. IF NOT EXISTS keeps this a no-op on the dev
-- database where the table was hand-applied during development.

CREATE TABLE IF NOT EXISTS passwordResets (
  tokenHash TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_passwordResets_user
  ON passwordResets(userId);
