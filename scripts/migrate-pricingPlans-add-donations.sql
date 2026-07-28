-- Migration: add the donation columns to pricingPlans.
--
-- schema.sql declares `pricingPlans` with `CREATE TABLE IF NOT EXISTS`, so on a
-- database that already had the table, re-running schema.sql will not add the
-- new columns. Donations are a third `kind` alongside 'tier' and 'pack' (see
-- workers/db-worker/src/billing.ts):
--
--   entitlementDays  how long the `supporter` entitlement lasts for this tier.
--                    NULL on tiers/packs, which grant no entitlement.
--   customAmount     1 = the Stripe price uses custom_unit_amount (the donor
--                    picks the amount on Stripe's page), so `amount` is
--                    legitimately NULL and the row is still purchasable.
--   perks            JSON array of strings rendered as the card's bullet list.
--
-- Run ONCE per environment whose `pricingPlans` table predates the columns:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-pricingPlans-add-donations.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-pricingPlans-add-donations.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; this errors (harmlessly) if a
-- column already exists. Fresh databases get them from schema.sql.

ALTER TABLE pricingPlans ADD COLUMN entitlementDays INTEGER;
ALTER TABLE pricingPlans ADD COLUMN customAmount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pricingPlans ADD COLUMN perks TEXT;
