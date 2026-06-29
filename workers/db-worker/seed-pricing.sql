-- Seed: pricing tiers + credit packs (placeholders, no prices).
--
-- DB-driven pricing (see src/billing.ts): `amount` is in minor units; NULL
-- renders as "Soon" on the client and disables purchase. These rows give the
-- pricing page something to show; fill in `amount`, `credits`, and
-- `stripePriceId` when you're ready — no deploy needed:
--   wrangler d1 execute mercurypitch-db-dev --remote --file workers/db-worker/seed-pricing.sql
-- Edit later with UPDATE, e.g.:
--   UPDATE pricingPlans SET amount = 800, credits = 50, stripePriceId = 'price_…' WHERE id = 'pack-plus';
--
-- INSERT OR IGNORE: safe to re-run; it won't overwrite edited rows.

-- Separation tiers (the "what you're buying speed/quality on" axis).
INSERT OR IGNORE INTO pricingPlans
  (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
VALUES
  ('tier-ondevice', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'tier', 'On-device', 'Runs in your browser. Free forever.', 'song', 0, 'eur', NULL, NULL, 'Free', 0, 1),
  ('tier-runpod-cpu', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'tier', 'Server (CPU)', 'Faster than on-device, lower credit cost.', 'song', NULL, 'eur', NULL, NULL, NULL, 1, 1),
  ('tier-runpod-gpu', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'tier', 'Server (GPU)', 'Fastest separation. Uses more credits.', 'song', NULL, 'eur', NULL, NULL, 'Default', 2, 1);

-- Credit packs (placeholders — set credits + amount + stripePriceId later).
INSERT OR IGNORE INTO pricingPlans
  (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
VALUES
  ('pack-starter', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'pack', 'Starter', 'A small bundle of credits to try server separation.', NULL, NULL, 'eur', NULL, NULL, NULL, 10, 1),
  ('pack-plus', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'pack', 'Plus', 'A bigger bundle at a better per-credit rate.', NULL, NULL, 'eur', NULL, NULL, NULL, 11, 1),
  ('pack-pro', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'pack', 'Pro', 'The best per-credit rate for heavy use.', NULL, NULL, 'eur', NULL, NULL, NULL, 12, 1);
