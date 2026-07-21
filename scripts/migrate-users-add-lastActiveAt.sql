-- =====================================================================
-- migrate-users-add-lastActiveAt.sql
--
-- Add lastActiveAt to track when a user last used the site with active
-- credentials. Unlike lastLoginAt (which only fires on token issuance,
-- once per 30-day JWT lifespan), lastActiveAt is updated on every
-- authenticated API request, throttled to 15-minute intervals.
--
-- Admin-only field — not exposed via /api/auth/me or publicUser().
--
-- Run against remote D1:
--   pnpm exec wrangler d1 execute mercurypitch-db --remote \
--     --config workers/db-worker/wrangler.jsonc \
--     --file scripts/migrate-users-add-lastActiveAt.sql
-- =====================================================================

ALTER TABLE users ADD COLUMN lastActiveAt TEXT;

-- Backfill: seed from the best available timestamp so existing users
-- don't show NULL until their next visit.
UPDATE users SET lastActiveAt = COALESCE(lastLoginAt, createdAt);
