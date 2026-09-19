-- 0047_newsletter_consent.sql — whether an account asked to hear from us.
--
-- Four columns on users rather than a table: one value per account, read on
-- every /api/auth/me, and a join on the profile read would buy history nobody
-- asked for. The precedent is users.leaderboardExcludedAt (0022).
--
-- newsletterOptIn is what the sender queries. The two timestamps and the
-- source are the record of consent — when it was given, when it was taken
-- back, and which surface it came from. That record is the part a regulator
-- asks for, and it is why the boolean is not left to be derived.
--
-- Living on the users row means account erasure already covers it: the
-- deletion contract in auth.ts needs no new entry, and there is no copy of
-- the list anywhere else to go stale.

ALTER TABLE users ADD COLUMN newsletterOptIn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN newsletterOptInAt TEXT;
ALTER TABLE users ADD COLUMN newsletterOptOutAt TEXT;
-- 'signup' | 'settings' | 'email' — the surface the last change came from.
ALTER TABLE users ADD COLUMN newsletterSource TEXT;

-- The sender's query: opted in, reachable, not suspended. Partial so it stays
-- small; the whole point is that most rows are not on the list.
CREATE INDEX IF NOT EXISTS idx_users_newsletter
  ON users (newsletterOptIn)
  WHERE newsletterOptIn = 1;
