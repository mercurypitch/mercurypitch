-- Account notices: the mail every account holder gets, whatever they said
-- about the newsletter.
--
-- A newsletter is sent because somebody said yes. A notice is sent because
-- we owe it to them: a data breach, a change to the terms, an account about
-- to be deleted for inactivity. Consent is not the basis and there is no way
-- out of it, so it shares nothing with `newsletterSends` but the shape.
--
-- Two tables, because they answer two different questions.

-- What was said. One row per notice, written the moment the first real copy
-- goes out, and never updated afterwards except for the two timestamps.
--
-- This is the record a regulator asks for: the wording, and when it went.
-- The operator's browser is not a record, and neither is an inbox we cannot
-- read. It holds no personal data, so it outlives every account it was sent
-- to -- which is the point of it.
--
-- `contentHash` is also a lock. A notice is mailed a page at a time, and a
-- slug whose wording changed between pages would mean two people hold two
-- different versions of "the" notice. A later page whose hash differs is
-- refused; a correction goes out under a new slug, as a correction.
CREATE TABLE IF NOT EXISTS accountNotices (
  -- Slug chosen by the operator, e.g. '2026-09-terms-update'.
  notice TEXT PRIMARY KEY,
  -- 'security' | 'legal' | 'account'. Decides the label above the headline
  -- and whether the mail carries the never-asks-for-your-password line.
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- The whole notice as JSON, exactly as it was rendered from.
  content TEXT NOT NULL,
  -- SHA-256 of the canonical content, hex.
  contentHash TEXT NOT NULL,
  firstSentAt TEXT NOT NULL,
  lastSentAt TEXT NOT NULL
);

-- Who has had it. One row per (notice, user) that the provider ACCEPTED, for
-- the same reason `newsletterSends` exists: a mailing is a loop, a loop can
-- stop half way, and running it again must not mail anybody twice.
--
-- No address is stored. It is on `users` and leaves with the account; a copy
-- here would be one the erasure registry has to be told about separately.
-- The rows themselves still name an account, so they are erased with it --
-- see USER_OWNED_TABLES in auth.ts. What survives an erasure is the row
-- above: that the notice went out, not to whom.
CREATE TABLE IF NOT EXISTS accountNoticeSends (
  notice TEXT NOT NULL,
  userId TEXT NOT NULL,
  -- Always bound by the worker as an ISO-8601 string. No DEFAULT on purpose:
  -- datetime('now') writes a different format, and the two do not compare.
  sentAt TEXT NOT NULL,
  -- The provider's message id, so a bounce can be traced to one send without
  -- keeping the message.
  providerId TEXT,
  PRIMARY KEY (notice, userId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accountNoticeSends_user ON accountNoticeSends (userId);
