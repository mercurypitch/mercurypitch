-- 0065_reapply_money_back_events.sql — let the sweep apply the refund and
-- dispute events an older worker recorded without acting on them.
--
-- The webhook used to record every event type it did not handle in
-- billingEvents, as processed. The worker on prod (v0.9.16) handles only
-- checkout.session.completed, so every charge.refunded and
-- charge.dispute.created Stripe delivered there was recorded and never
-- applied, and so would a refund.failed, refund.updated or
-- charge.dispute.closed be, if an endpoint subscribed to them before this
-- release. The reconciliation sweep skips a recorded event: none of those
-- would ever be applied.
--
-- Forgetting them lets the first sweep after the deploy apply the ones
-- Stripe still lists (the last 30 days), oldest first. Applying one twice is
-- safe: each writes at most one ledger row keyed by its event id
-- (`clawback:<event id>`) or by its refund (`clawback:refund-ended:<id>`),
-- so an event a newer worker applied already (dev ran PR 961's) writes
-- nothing more. A refund of a purchase made before PaymentIntent ids were
-- stored (migration 0058, not on prod before this release) finds no credits
-- on record and sends that alert, for a take-back by hand. The sweep's
-- alert lists every event it applied.
--
-- Checkout events are left alone: those were granted when they were
-- recorded, and applying one again under another event id would grant twice.
DELETE FROM billingEvents
 WHERE type IN (
   'charge.refunded',
   'refund.failed',
   'refund.updated',
   'charge.dispute.created',
   'charge.dispute.closed'
 );
