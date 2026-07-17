-- Migration: create the emailVerifications table on pre-existing databases.
--
-- Password signups now receive a "confirm your email" link (see
-- workers/db-worker/src/auth.ts — sendVerificationEmail / handleVerifyEmail).
-- The table stores the SHA-256 of each outstanding token; without it,
-- register and resend-verification crash with a D1_ERROR
-- ("no such table: emailVerifications").
--
-- Statements match schema.sql and are idempotent (IF NOT EXISTS), so this
-- is safe to run on any environment:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-add-emailVerifications.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-add-emailVerifications.sql
-- Fresh databases get the table from schema.sql and do not need this.

CREATE TABLE IF NOT EXISTS emailVerifications (
  tokenHash TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emailVerifications_user
  ON emailVerifications(userId);
