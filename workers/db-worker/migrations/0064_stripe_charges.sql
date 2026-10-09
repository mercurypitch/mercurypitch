-- 0064_stripe_charges.sql — what Stripe last said about a charge that money
-- went back on.
--
-- A refund or a dispute is applied from what Stripe reports at that moment
-- (stripe-charge.ts): the charge, its refunds and its disputes, never the
-- copy an event carries, so events read late or out of order land on the
-- same answer. The answer is kept here, one row per PaymentIntent: a
-- purchase whose webhook lands after its own refund or dispute reads it and
-- takes back what is due at once (stripe-payments.ts, settleEarlyMoneyBack).
--
-- Amounts are in the charge's minor units (500 is EUR 5.00).
-- `amountRefunded` adds up the refunds that did not fail or get canceled.
-- `disputes` is a JSON array of the charge's disputes: id, status, amount,
-- currency, reason code and evidence deadline, almost always none or one.
-- No personal data: Stripe ids, amounts, statuses and reason codes. No
-- userId either, so account deletion has nothing here to remove.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS stripeCharges (
  paymentIntentId TEXT PRIMARY KEY,
  chargeId TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  amountRefunded INTEGER NOT NULL,
  disputes TEXT NOT NULL DEFAULT '[]',
  updatedAt TEXT NOT NULL
);
