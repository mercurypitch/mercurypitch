-- 0058_ledger_payment_intent.sql — the Stripe payment behind a ledger row.
--
-- A refund or a dispute names the PaymentIntent the money came from, never a
-- row of ours. A paid checkout now writes its session's PaymentIntent id on
-- the rows it grants (billing.ts: a pack's credits, a donation's audit row,
-- and the launch offer's bonus credits), so charge.refunded and
-- charge.dispute.created can find what the payment granted and take it back
-- (stripe-payments.ts).
--
-- Nullable and not back-filled: Stripe holds the ids, SQL does not. A refund
-- of a payment from before this takes nothing back, and the billing alert
-- says so.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one nullable column changes nothing they wrote.
ALTER TABLE creditLedger ADD COLUMN paymentIntentId TEXT;

CREATE INDEX IF NOT EXISTS idx_creditLedger_paymentIntentId
  ON creditLedger(paymentIntentId)
  WHERE paymentIntentId IS NOT NULL;
