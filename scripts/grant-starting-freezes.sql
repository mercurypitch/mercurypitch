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
