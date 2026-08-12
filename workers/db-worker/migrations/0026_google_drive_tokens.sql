-- 0026_google_drive_tokens.sql — the key to a user's own Drive folder.
--
-- Google Drive is a sync TRANSPORT (docs/plans/device-sync.md, Phase 4):
-- song bundles go browser -> Drive and Drive -> browser directly, so the
-- audio still never transits or rests on our servers. What the worker
-- holds is only the OAuth refresh token that lets the browser mint
-- short-lived access tokens for the user's own `drive.file` scope --
-- which reaches ONLY files this app created, not the rest of their
-- Drive.
--
-- The refresh token is sealed with AES-GCM before it is written (key
-- derived from JWT_SECRET via HKDF, see sealDriveToken in auth.ts), so a
-- leaked database copy alone does not grant Drive access.
--
-- Not a synced entity: this table is worker-internal, like sessions and
-- passwordResets, and deliberately absent from tables.ts.

CREATE TABLE IF NOT EXISTS googleDriveTokens (
  userId TEXT PRIMARY KEY,
  -- base64(iv || AES-GCM ciphertext) of the Google refresh token.
  refreshToken TEXT NOT NULL,
  -- The scopes Google reported granted, so a partial consent is legible.
  scope TEXT NOT NULL,
  -- Which Google account's Drive this is, for the settings UI.
  email TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
