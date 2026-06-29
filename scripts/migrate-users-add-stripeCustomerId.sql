-- Migration: add users.stripeCustomerId to pre-existing databases.
--
-- schema.sql declares `users` with `CREATE TABLE IF NOT EXISTS`, so on a
-- database that already had a `users` table, re-running schema.sql will not
-- add the new column. billing.ts stores the Stripe customer id here on the
-- user's first checkout so future purchases reuse the same customer.
--
-- Run ONCE per environment whose `users` table predates the column:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-users-add-stripeCustomerId.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-users-add-stripeCustomerId.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; this errors (harmlessly) if
-- the column already exists. Fresh databases get the column from schema.sql.

ALTER TABLE users ADD COLUMN stripeCustomerId TEXT;
