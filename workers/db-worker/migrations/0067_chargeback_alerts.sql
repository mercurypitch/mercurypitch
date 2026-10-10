-- 0067_chargeback_alerts.sql — the chargebacks the owner has been told of.
--
-- When a buyer's bank takes the money back for a dispute, Stripe sends
-- charge.dispute.funds_withdrawn. The owner hears of it from the dispute's
-- opening when it opened as a chargeback (charge.dispute.created read as
-- one), but not when it opened as an inquiry, and not when the worker has
-- no record of its opening. One row per dispute whose chargeback the owner
-- has been told of, written with the alert that told them
-- (stripe-payments.ts): funds_withdrawn alerts only for a dispute with no
-- row here, whether or not credits moved and whether or not any credits
-- are on record for the payment, and its INSERT OR IGNORE makes that alert
-- go once.
--
-- No personal data: Stripe ids and a time. No userId either, so account
-- deletion has nothing here to remove.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS chargebackAlerts (
  disputeId TEXT PRIMARY KEY,
  paymentIntentId TEXT,
  eventId TEXT NOT NULL,
  alertedAt TEXT NOT NULL
);
