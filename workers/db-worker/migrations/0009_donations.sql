-- 0009_donations.sql — supporter donation tiers (PR #362), converted from
-- that PR's schema.sql edit + ad-hoc migrate script + seed file into the
-- tracked chain.
--
-- pricingPlans gains a third kind, 'donation' (alongside 'tier' | 'pack'):
--   entitlementDays  days of `supporter` entitlement this row grants
--                    (NULL on tiers/packs, which grant none)
--   customAmount     1 = the Stripe price uses custom_unit_amount (donor
--                    picks the amount on Stripe's page), so `amount` is
--                    legitimately NULL and the row is still purchasable
--   perks            JSON array of strings, rendered as the card bullets
--
-- The three ALTERs are ONE-SHOT (SQLite has no ADD COLUMN IF NOT EXISTS).
-- If a database was hand-migrated during development, record this file as
-- applied in d1_migrations instead of re-running it (see
-- scripts/README-legacy-migrations.md). The placeholder seeds never
-- overwrite operator-edited rows, and amount/stripePriceId stay NULL on
-- purpose - prices are wired per environment, never in the public repo.

ALTER TABLE pricingPlans ADD COLUMN entitlementDays INTEGER;
ALTER TABLE pricingPlans ADD COLUMN customAmount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pricingPlans ADD COLUMN perks TEXT;

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
