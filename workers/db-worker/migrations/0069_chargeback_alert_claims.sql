-- 0069_chargeback_alert_claims.sql — a chargeback's mail goes before it is
-- recorded as told.
--
-- chargebackAlerts (0067) records each dispute whose chargeback the owner
-- has been told of. Since this migration a dispute is recorded there only
-- once Resend has taken the mail that tells them (chargeback-alert.ts):
-- when Resend refuses it, nothing is recorded, and the event answers 500
-- so Stripe sends it again. Stripe sends charge.dispute.created and
-- charge.dispute.funds_withdrawn at once for a dispute that opens as a
-- chargeback, and may deliver either twice, so a delivery claims the
-- dispute here before it mails, and only the one that claimed it tells the
-- owner:
--
--   eventId: the Stripe event that took the claim. The same event delivered
--     again while it is held answers 500, so Stripe sends it once more;
--     another event about the same dispute leaves the mail to it.
--   claimedAt: when the claim was taken. A claim older than 10 minutes
--     belongs to a delivery that died, and the next one takes it over.
--
-- A claim is deleted when its dispute is recorded as told, and when the
-- mail does not go, so the next delivery tells the owner.
--
-- No personal data: Stripe ids and a time.
--
-- Purely additive: one new table changes nothing other branches wrote on
-- the shared preview database, and 0067 stays as it was applied.
CREATE TABLE IF NOT EXISTS chargebackAlertClaims (
  disputeId TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  claimedAt TEXT NOT NULL
);
