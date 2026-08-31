-- Passkeys.
--
-- Only the PUBLIC half of the key pair ever reaches this table. A dump of this
-- database lets nobody sign in as anybody: the private key never leaves the
-- authenticator that made it, which is the property that makes a passkey worth
-- more than a password to begin with.
--
-- `counter` is the authenticator's own signature counter. Its only job is to
-- reveal a cloned credential: a counter that goes BACKWARDS means two things
-- are answering for one key, which no honest authenticator does.

CREATE TABLE IF NOT EXISTS webauthnCredentials (
  -- The authenticator's credential id, base64url. Globally unique by
  -- construction, so it is the primary key.
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  -- COSE public key bytes, base64url.
  publicKey TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  -- JSON array of AuthenticatorTransport, so the browser can hint at which
  -- device to prompt for ("your phone", "your security key").
  transports TEXT,
  deviceName TEXT,
  -- Whether the credential syncs through a provider keychain. A device-bound
  -- key that is NOT backed up dies with the device, which is worth telling
  -- somebody before it is their only way in.
  backedUp INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  lastUsedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_webauthnCredentials_user ON webauthnCredentials(userId);
