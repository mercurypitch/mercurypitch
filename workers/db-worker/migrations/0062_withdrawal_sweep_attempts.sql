-- 0062_withdrawal_sweep_attempts.sql — what the 6-hourly sweep needs to
-- reach every unfinished duty, the longest untried first.
--
-- The sweep (withdrawal-finish.ts, checkout-consent.ts) runs four duties,
-- each with its own batch: an acknowledgement not sent, a refund still
-- pending, a refund Stripe has not finished, and a purchase mail not sent.
-- Each takes its rows by when they were last tried, so rows that keep
-- failing never hold back a later one.
--
-- withdrawals gains three columns:
--
--   refundTriedAt: when a request or the sweep last asked Stripe about the
--     refund, to make it or to follow it. NULL: never.
--   refundEscalatedAt: when the owner was told the refund was still open
--     5 days after the statement. Once per statement.
--   mailAttempts: how many times the acknowledgement was tried.
--
-- checkoutConsents gains mailAttempts, the purchase mail's tries. The sweep
-- gives either mail up after 6 tries or 3 days, whichever comes first.
--
-- A row from before this migration counts 0 tries and was never tried.
--
-- Purely additive, like 0060 and 0061: the shared preview database carries
-- other branches' migrations, and new columns change nothing they wrote.
-- Numbered 0062, which no open branch uses, beside main's 0063.
ALTER TABLE withdrawals ADD COLUMN refundTriedAt TEXT;
ALTER TABLE withdrawals ADD COLUMN refundEscalatedAt TEXT;
ALTER TABLE withdrawals ADD COLUMN mailAttempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE checkoutConsents ADD COLUMN mailAttempts INTEGER NOT NULL DEFAULT 0;
