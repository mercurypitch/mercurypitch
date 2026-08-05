-- Streak freezes accrue on a clock, not on a streak milestone.
--
-- The old rule earned a freeze at streak multiples of seven, which handed
-- forgiveness to whoever was already keeping a streak and none to whoever had
-- just lost one. Freezes now accrue one per thirty days waited, which needs an
-- anchor of its own: a date derived from practice would only ever advance for
-- people who practise, and the whole point is that an idle month accrues too.
--
-- Schema only. The one-time top-up of existing accounts to the new starting
-- balance is `scripts/grant-starting-freezes.sql`, run by hand from the release
-- checklist — a numbered migration that CI applies is the wrong place to hand
-- out currency, because it would run unreviewed against prod at tag time and
-- could never be undone by re-running it.

ALTER TABLE userProfiles ADD COLUMN lastFreezeEarnedDate TEXT;
