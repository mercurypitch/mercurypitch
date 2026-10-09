-- 0061_withdrawal_refund_tracking.sql — what a withdrawal's refund rests on,
-- and where Stripe has it.
--
-- withdrawals gains three columns (withdrawal.ts):
--
--   refundBasis: 'unused', the unused paid credits' share of the price, or
--     'full', the whole price: the purchase has no ticked consent box on
--     record, so its buyer bears no cost for what they used (CRD
--     Art. 14(4)(b)). The refund of a 'full' one takes nothing more back
--     (stripe-payments.ts).
--   priceSource: where the price came from: 'checkout' (checkoutConsents),
--     'stripe' (the PaymentIntent's amount_received), or 'none' when neither
--     knew it and the owner refunds by hand. Never the catalogue price.
--   stripeRefundStatus: the refund's own status at Stripe. One Stripe takes
--     can still be 'pending' or 'requires_action'; the 6-hourly sweep asks
--     again until it is 'succeeded', or marks the statement 'failed' and
--     alerts the owner when it ends 'failed' or 'canceled'.
--
-- NULL in any of them is a statement from before this migration: an
-- 'unused' refund that Stripe's answer settled.
--
-- checkoutConsents gains a partial index over the purchase mails the sweep
-- may still have to send, so a run never reads every purchase.
--
-- Purely additive, like 0060: the shared preview database carries other
-- branches' migrations, and nullable columns change nothing they wrote.
ALTER TABLE withdrawals ADD COLUMN refundBasis TEXT;
ALTER TABLE withdrawals ADD COLUMN priceSource TEXT;
ALTER TABLE withdrawals ADD COLUMN stripeRefundStatus TEXT;

CREATE INDEX IF NOT EXISTS idx_checkoutConsents_unsent
  ON checkoutConsents(createdAt)
  WHERE mailStatus IS NULL OR mailStatus IN ('failed', 'sending');
