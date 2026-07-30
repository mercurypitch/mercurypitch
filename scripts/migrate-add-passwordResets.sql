-- Migration: create the passwordResets table on pre-existing databases.
--
-- The forgot-password flow (see workers/db-worker/src/auth.ts —
-- handleForgotPassword / handleResetPassword) emails a single-use reset
-- link and stores only the SHA-256 of the token here. Without the table,
-- forgot-password crashes with a D1_ERROR ("no such table: passwordResets").
--
-- Statements match schema.sql and are idempotent (IF NOT EXISTS), so this
-- is safe to run on any environment:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-add-passwordResets.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-add-passwordResets.sql
-- Fresh databases get the table from schema.sql and do not need this.

CREATE TABLE IF NOT EXISTS passwordResets (
  tokenHash TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_passwordResets_user
  ON passwordResets(userId);
