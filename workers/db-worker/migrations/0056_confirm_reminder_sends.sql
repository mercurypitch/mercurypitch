-- Fresh confirm links: which never-confirmed accounts were sent one more
-- confirm link, and whether they confirmed afterwards (confirm-reminders.ts).
--
-- The newsletter and the account notices leave an unconfirmed address alone
-- on purpose: it may have been typed by somebody else. This door mails
-- exactly those addresses, so it is held to one fresh link per account, ever.
-- The mail promises "ignore this and we won't write to this address again",
-- and this table is what keeps that promise: an account with any row here is
-- never picked again, whatever the campaign.
--
-- A row is written BEFORE the mail goes (write-ahead), so a page that stops
-- half way can never mail anybody twice. A send the provider refuses takes
-- its row back out, so a refused address is still owed its link.
--
-- No address is stored. It is on `users` and leaves with the account; the
-- rows name an account, so they go with it too (USER_OWNED_TABLES in
-- auth.ts, and the foreign key below).
--
-- Purely additive: the shared preview database carries other branches'
-- migrations and rows, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS confirmReminderSends (
  -- Slug chosen by the operator, e.g. 'fresh-link-2026-10'.
  campaign TEXT NOT NULL,
  userId TEXT NOT NULL,
  -- Always bound by the worker as an ISO-8601 string. No DEFAULT on purpose:
  -- datetime('now') writes a different format, and the two do not compare.
  sentAt TEXT NOT NULL,
  -- The provider's message id, once it accepted the mail. NULL while the
  -- send is in flight, or if the worker stopped between the two writes.
  resendId TEXT,
  -- Stamped by the confirm link handler (handleVerifyEmail) when this
  -- account confirms its address after the fresh link went out. That one
  -- UPDATE is the whole "did it work" measurement.
  confirmedAt TEXT,
  PRIMARY KEY (campaign, userId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

-- The lifetime cap reads "any row for this account", across campaigns.
CREATE INDEX IF NOT EXISTS confirmReminderSends_user ON confirmReminderSends (userId);
