-- ── TOTP two-factor authentication ───────────────────────────────────
--
-- `secretEnc` is the base32 TOTP secret encrypted with AES-256-GCM under a key
-- HKDF-derived from the TOTP_KEK secret (see twofa.ts). Not plaintext, because
-- a leaked database must not hand out every singer's second factor alongside
-- their password hashes.
--
-- TOTP_KEK is a separate secret rather than something derived from JWT_SECRET.
-- The alternative needs no ops work at all, which is tempting, and costs this:
-- rotating JWT_SECRET would silently orphan every TOTP secret in the table.
-- This repository already made the same call once and wrote it down — see the
-- "do not reuse JWT_SECRET" note on BACKGROUND_CAPABILITY_SECRET in
-- wrangler.jsonc.
--
-- `confirmedAt` is NULL between "show the QR code" and "a valid code was
-- typed". Only a confirmed row makes sign-in demand a second factor: an
-- enrollment somebody started and walked away from must never lock them out.
--
-- `lastUsedStep` is the RFC 6238 anti-replay high-water mark. A code at or
-- below it is spent, so a code read over someone's shoulder buys nothing even
-- inside the thirty seconds it would otherwise still be valid for.
CREATE TABLE IF NOT EXISTS totpCredentials (
  userId TEXT PRIMARY KEY,
  secretEnc TEXT NOT NULL,
  -- Which key encrypted `secretEnc`. One value today; the column exists so a
  -- future TOTP_KEK rotation can re-wrap rows instead of orphaning them.
  keyVersion INTEGER NOT NULL DEFAULT 1,
  lastUsedStep INTEGER,
  confirmedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single-use backup codes, for the phone that was lost or wiped.
--
-- Same shape and the same reasoning as passwordResets (0008): only a SHA-256
-- hash is stored, so a leaked database yields nothing anyone could type. The
-- raw codes exist exactly once, on the sheet the singer saved at enrollment.
--
-- Hashed rather than encrypted on purpose: these are the fallback for the case
-- where the TOTP secret cannot be decrypted at all, so they must not depend on
-- the same key.
CREATE TABLE IF NOT EXISTS recoveryCodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  codeHash TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recoveryCodes_user ON recoveryCodes(userId);
