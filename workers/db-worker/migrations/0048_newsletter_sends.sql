-- Newsletter delivery log.
--
-- One row per (issue, user) that Resend ACCEPTED. It exists for one reason:
-- a send is a loop over a recipient list, and a loop that half-finishes --
-- a rate limit, a dropped connection, an operator's Ctrl-C -- has to be
-- safe to run again. Re-running skips anyone already in here, so nobody
-- gets the same issue twice.
--
-- It is deliberately NOT a copy of the audience. Consent lives on
-- users.newsletterOptIn and nowhere else; this table only records what was
-- already sent, which is history rather than permission. A row here for
-- someone who has since opted out is correct and must never be read as a
-- reason to mail them.
--
-- No email address is stored. The address is on `users` and follows the
-- account when it is erased; duplicating it here would leave a copy behind
-- that the erasure registry does not know about.

CREATE TABLE IF NOT EXISTS newsletterSends (
  -- Slug of the issue, e.g. 'v0-9-10-jam-pitch'. Chosen by the operator and
  -- typed into the send command; the pair below is what makes a re-run safe.
  issue TEXT NOT NULL,
  userId TEXT NOT NULL,
  sentAt TEXT NOT NULL DEFAULT (datetime('now')),
  -- Resend's message id, so a bounce or a complaint can be traced back to a
  -- specific send without keeping the message itself.
  providerId TEXT,
  PRIMARY KEY (issue, userId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletterSends_user ON newsletterSends (userId);
