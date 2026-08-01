-- 0001_perkGrants.sql — supporter cosmetic perk grants.
--
-- This migration chain belongs to the SHARED perks database
-- (mercurypitch-perks): one D1 bound to BOTH the dev and prod workers on
-- purpose, so a donor's perk is published once and follows them in every
-- environment. Because dev and prod have separate user tables (different
-- user-id spaces), grants are keyed by lowercase-folded EMAIL — the only
-- identity that is the same person across environments. Anonymous users
-- have no email and therefore cannot hold perks (donors are signed in by
-- definition).
--
-- A grant is one row; revocation stamps revokedAt instead of deleting so
-- the ledger keeps its history. Re-granting clears revokedAt.

CREATE TABLE IF NOT EXISTS perkGrants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  perkId TEXT NOT NULL,
  -- 'manual' via grant-perks.sh / companyReportViewer today;
  -- 'stripe' once donation-payment auto-granting is wired.
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  grantedAt TEXT NOT NULL,
  revokedAt TEXT,
  UNIQUE (email, perkId)
);

CREATE INDEX IF NOT EXISTS idx_perkGrants_email ON perkGrants (email);
