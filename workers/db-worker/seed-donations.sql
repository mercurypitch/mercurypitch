-- Seed: supporter donation tiers (placeholders, no prices).
--
-- Donations are `kind = 'donation'` rows in the same DB-driven pricingPlans
-- table as tiers and packs (see src/billing.ts). They are one-time payments
-- that grant a time-boxed `supporter` entitlement — never a feature gate.
--
-- As with credits, `amount` and `stripePriceId` are deliberately NULL here:
-- prices do not live in this (public) repo. The cards render "Soon" and are
-- not purchasable until you wire them per environment — no deploy needed:
--   wrangler d1 execute mercurypitch-db-dev --remote --file workers/db-worker/seed-donations.sql
--   wrangler d1 execute mercurypitch-db-dev --remote --command \
--     "UPDATE pricingPlans SET amount = 500, stripePriceId = 'price_…', updatedAt = datetime('now') WHERE id = 'sup-fund'"
--
-- `sup-custom` is the "Other amount" row: its Stripe price uses
-- custom_unit_amount, so the donor types the amount on Stripe's own page and
-- `amount` stays NULL forever. customAmount = 1 is what keeps it purchasable.
-- Its entitlementDays is the floor — donationDays() scales the grant with the
-- amount actually paid.
--
-- `perks` is a JSON array of strings rendered as the card's bullet list.
-- Anything not built yet carries a "(coming)" marker; edit these rows the day
-- it ships, no release required.
--
-- INSERT OR IGNORE: safe to re-run; it won't overwrite edited rows.

INSERT OR IGNORE INTO pricingPlans
  (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active, entitlementDays, customAmount, perks)
VALUES
  ('sup-fund', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'donation', 'Chime',
   'The no-questions fund — keeps the servers on and the work going.', NULL, NULL, 'eur', NULL, NULL, NULL, 20, 1, 30, 0,
   '["Supporter badge on your profile","No questions asked — it just funds the work"]'),

  ('sup-extras', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'donation', 'Chorus',
   'Everything in Chime, plus the cosmetic and early-access extras.', NULL, NULL, 'eur', NULL, NULL, 'Popular', 21, 1, 90, 0,
   '["Everything in Chime","Mascot costumes (coming)","Custom backgrounds (coming)","Beta features before everyone else","Behind-the-scenes build insights"]'),

  ('sup-voice', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'donation', 'Anthem',
   'Everything in Chorus, plus a say in where MercuryPitch goes next.', NULL, NULL, 'eur', NULL, NULL, NULL, 22, 1, 180, 0,
   '["Everything in Chorus","A say in what gets prioritized","Your bug reports jump the queue","Priority mail support"]'),

  ('sup-custom', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'donation', 'Other amount',
   'Pick your own amount. Longer support for a larger donation.', NULL, NULL, 'eur', NULL, NULL, NULL, 23, 1, 30, 1,
   '["You choose the amount on the next screen","Match a tier''s amount and you get that tier''s badge","Longer support the more you give"]');
