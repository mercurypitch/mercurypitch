-- Signing a TV in by scanning it with a phone.
--
-- A TV remote makes typing an email tolerable and a password miserable,
-- which is why every streaming app on a television does this instead. The
-- shape is the standard device-authorization one: the TV asks for a code,
-- shows it, and polls; the phone -- already signed in, with a real
-- keyboard -- confirms; the TV is handed a session.
--
-- Two secrets, deliberately. `code` is the short thing on screen, so
-- anyone in the room can read it. `pollTokenHash` is known ONLY to the TV
-- that asked, and it is what the poll must present -- so reading a code
-- off somebody's television is not enough to be handed their account.
-- Neither the poll token nor the minted session is stored in the clear.
--
-- Rows are short-lived by design (minutes) and single-use: `approvedAt`
-- and `claimedAt` make a replay visible rather than merely unlikely.

CREATE TABLE IF NOT EXISTS deviceLinkCodes (
  -- The short code shown on the TV and carried by the QR.
  code TEXT PRIMARY KEY,
  -- SHA-256 of the secret only the requesting device holds.
  pollTokenHash TEXT NOT NULL,
  -- What the phone is being asked to authorise, shown before it agrees.
  deviceLabel TEXT,
  -- Set when the phone approves; the account the TV will become.
  userId TEXT,
  approvedAt TEXT,
  -- Set when the TV has collected its session, so it cannot be collected
  -- twice from a code somebody photographed.
  claimedAt TEXT,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

-- Expiry sweeps scan by time, and an approved row is looked up by user
-- when showing somebody what they have linked.
CREATE INDEX IF NOT EXISTS idx_deviceLinkCodes_expiresAt
  ON deviceLinkCodes (expiresAt);
CREATE INDEX IF NOT EXISTS idx_deviceLinkCodes_userId
  ON deviceLinkCodes (userId);
