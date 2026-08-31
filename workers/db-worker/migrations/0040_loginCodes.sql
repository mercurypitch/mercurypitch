-- Sign in with a code sent to your email.
--
-- The row is the unit of trust, not the code. A ceremony token addresses one
-- id; verification asks "does this match THAT row", never "does this match any
-- live code for this address". So firing /request at somebody else's address
-- buys a token for a code you cannot read, and no surface to guess at theirs.
--
-- `email` is kept beside `userId` because a code is minted for an ADDRESS: if
-- the account's address changes while a code is in flight, the code must stop
-- working rather than silently authorise the new one.

CREATE TABLE IF NOT EXISTS loginCodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,
  -- SHA-256 hex. The readable code exists only in the email; a D1 dump is not
  -- a set of live sign-ins.
  codeHash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loginCodes_email ON loginCodes(email);
CREATE INDEX IF NOT EXISTS idx_loginCodes_user ON loginCodes(userId);
