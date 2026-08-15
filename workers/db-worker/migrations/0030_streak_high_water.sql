-- ── longestStreak becomes the high-water mark it always claimed to be ──
--
-- `userProfiles.longestStreak` is treated everywhere as the streak record:
-- 0004_leaderboardConfig.sql gates board entry on it, handleLeaderboard
-- RANKS the 'streak' category on it, and the Home card labels it "longest".
-- Nothing ever made that true. The client that owned streak writes before
-- f2a5ccc updated `currentStreak` and `lastPracticeDate` only, and this
-- column arrived as `INTEGER NOT NULL DEFAULT 0` with no semantic backfill,
-- so every row that existed then holds a literal 0 however many days its
-- owner actually ran.
--
-- The read-time repair meant to cover that could never fire.
-- `streakFieldsOf` spelled it `p?.longestStreak ?? p?.currentStreak`, and a
-- stored 0 is not nullish -- the identical trap `streakFreezes` hit in the
-- same file, fixed there and left standing here. `computeStreakState` then
-- reported `max(longestStreak, displayStreak)` to the card, so the app
-- looked right while the column stayed wrong, which is why this survived.
--
-- Measured before writing: 60 of the 80 production rows holding any streak
-- at all, and 13 of 17 on dev. Fifty-nine of the sixty store (1, 0).
--
-- ORDER MATTERS. The invariant that keeps these rows repaired lives in the
-- Worker (`clampStreakHighWater`, src/index.ts) and must be deployed BEFORE
-- this statement runs -- a client still on the old bundle would otherwise
-- re-introduce a violation in the window between the two. Deployed in that
-- order the repair needs no maintenance window at all: every write landing
-- mid-migration is already clamped. See docs/plans/streak-high-water.md.
--
-- Idempotent by construction -- it raises a record to the run that beat it,
-- so a second pass selects nothing. It never lowers `currentStreak`, never
-- deletes a profile, and leaves a row whose record already outlives its
-- current run (1, 7) exactly as it is.

UPDATE userProfiles
   SET longestStreak = currentStreak
 WHERE currentStreak > longestStreak;
