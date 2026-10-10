-- 0066_withdrawal_mail_outcomes.sql — no mail or refund is let go before
-- the owner has heard.
--
-- The purchase mail (checkout-consent.ts) and the withdrawal
-- acknowledgement (withdrawal-ack.ts) are never given up while Resend's
-- answer is unknown (no answer, a 5xx, a 429, a 409). One Resend refuses
-- for good (any other 4xx) is 'refused' until Resend has taken the owner's
-- alert about it, and only then 'gave-up'. The sweep keeps sending an
-- unknown one, and tells the owner once when it has still not gone after
-- 3 days. A refund the owner has to make by hand ('failed' or 'manual',
-- withdrawal-finish.ts) is told again at every sweep until Resend has taken
-- the alert about it.
--
-- withdrawals gains three columns:
--
--   mailError: what Resend answered the acknowledgement's last try, for
--     the owner's alerts.
--   mailWarnedAt: when Resend took the alert that the acknowledgement had
--     still not gone 3 days after the statement. Once per statement.
--   refundHandedOverAt: when Resend took the alert that hands the refund to
--     the owner, to make by hand or to finish at Stripe by day 14 (CRD
--     Art. 13(1)): the one for a refund Stripe refused or failed, or one
--     never Stripe's to make, and the one 11 days after the statement for a
--     refund still not through. NULL on a refund to make by hand: the owner
--     has not heard yet, and the account cannot be deleted.
--
-- checkoutConsents gains mailError and mailWarnedAt, the same for the
-- purchase mail, and a partial index over the mails the sweep still has to
-- send or give up, now 'refused' among them: idx_checkoutConsents_unsent
-- (0061) cannot serve a query that reaches 'refused' rows. That index stays
-- for the code other branches run on the shared preview database.
--
-- Purely additive, like 0060 to 0062: new nullable columns change nothing
-- other branches wrote. Numbered 0066 beside #970's 0064 and 0065; either
-- order applies cleanly.
ALTER TABLE withdrawals ADD COLUMN mailError TEXT;
ALTER TABLE withdrawals ADD COLUMN mailWarnedAt TEXT;
ALTER TABLE withdrawals ADD COLUMN refundHandedOverAt TEXT;
ALTER TABLE checkoutConsents ADD COLUMN mailError TEXT;
ALTER TABLE checkoutConsents ADD COLUMN mailWarnedAt TEXT;

CREATE INDEX IF NOT EXISTS idx_checkoutConsents_open
  ON checkoutConsents(createdAt)
  WHERE mailStatus IS NULL OR mailStatus IN ('failed', 'sending', 'refused');
