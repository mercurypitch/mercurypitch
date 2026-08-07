-- NOT part of the prod release. Off the checklist, kept for one narrow case.
--
-- `accrueFreezes` hands the opening balance to any profile with a null
-- accrual anchor, so an account that predates the rule heals itself on its
-- next read and needs nothing from this file. Prod is entirely in that
-- category: `lastFreezeEarnedDate` arrives with migration 0017 and nothing
-- has been deployed there since v0.7.22, so every prod row reaches the new
-- code with a null anchor.
--
-- The case that is not self-healing is an anchor already stamped by a build
-- that set it without granting — possible only where migration 0017 was
-- applied and an interim build then ran against it, which means dev, and
-- only if someone pointed a local session at remote dev D1. Those rows sit
-- at an anchored zero for ever, because the null branch is the only one that
-- seeds. This file is the fix for exactly them. Check before running:
--
--   SELECT COUNT(*) FROM userProfiles
--    WHERE streakFreezes = 0 AND lastFreezeUsedDate IS NULL
--      AND lastFreezeEarnedDate IS NOT NULL;
--
-- Zero rows means there is nothing to do. Everything below describes the
-- original intent.
--
-- One-time: give existing accounts the new starting balance of streak freezes.
--
-- Run BY HAND, from the release checklist, after migration 0017 has applied.
-- Deliberately not a numbered migration: this hands out currency rather than
-- changing a shape, so it wants a human deciding when it happens and against
-- which database.
--
--   pnpm exec wrangler d1 execute mercurypitch-db-dev --remote --env dev \
--     --file=scripts/grant-starting-freezes.sql
--   pnpm exec wrangler d1 execute mercurypitch-db --remote --env prod \
--     --file=scripts/grant-starting-freezes.sql
--
-- Idempotent, and narrower than it looks. `streakFreezes = 0` is the condition
-- that makes re-running it harmless — an account topped up to 2 no longer
-- matches. `lastFreezeUsedDate IS NULL` is what keeps it from being a refill:
-- somebody who earned freezes under the old rule and spent them down to zero
-- made that trade, and handing the balance back would undo it. They accrue
-- again on the thirty-day clock like everyone else.
--
-- New profiles do not need this: `streakFieldsOf` starts them at
-- STARTING_FREEZES.

UPDATE userProfiles
   SET streakFreezes = 2
 WHERE (streakFreezes IS NULL OR streakFreezes = 0)
   AND lastFreezeUsedDate IS NULL;
