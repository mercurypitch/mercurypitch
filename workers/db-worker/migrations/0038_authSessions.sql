-- ── One row per signed-in device ─────────────────────────────────────
--
-- Sessions were stateless: a JWT, and a single `users.tokenVersion` counter
-- that could only ever revoke ALL of them at once. So "sign out" had two
-- possible meanings and the product shipped the wrong one — signing out on a
-- phone revoked the laptop and the television too — and there was no way to
-- show anyone where they were signed in, or to end one device without ending
-- every device.
--
-- It also blocked the one thing turning on 2FA has to do. Every session that
-- predates enrollment got in on a single factor, including — in the case the
-- feature exists for — an intruder's. Without this table the only available
-- choices are "sign out nobody" and "sign out everybody, including the person
-- standing in the middle of the setup wizard", and neither is right.
--
-- The JWT now carries a `sid` and this table is what it points at. Deleting a
-- row ends exactly one device. `tokenVersion` stays as the blunt instrument
-- behind "sign out everywhere", because it is the only thing that can revoke a
-- token issued before this table existed — those carry no `sid` at all and go
-- on verifying until they expire, which is deliberate: a hard cutover would
-- sign every singer out of an app they were using at the time.
CREATE TABLE IF NOT EXISTS authSessions (
  -- Random uuid, embedded in the JWT as `sid`. Not a secret: holding it grants
  -- nothing without the signed token that names it.
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  -- 'password' | 'google' | 'anonymous' | 'email' | 'passkey' | 'device-link'
  provider TEXT,
  -- What the device was when it signed in. Kept verbatim; the readable label
  -- is derived at render time, so improving that parser never needs a backfill.
  userAgent TEXT,
  ip TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  -- Updated at most once every few minutes, not on every request — see
  -- SESSION_TOUCH_SECONDS in auth-sessions.ts. A write in front of every
  -- authenticated call, for a column nobody reads more precisely than "today",
  -- is not a trade worth making.
  lastSeenAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_authSessions_user ON authSessions(userId);
CREATE INDEX IF NOT EXISTS idx_authSessions_lastSeen ON authSessions(lastSeenAt);
