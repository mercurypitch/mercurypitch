-- 0015_grant_rows_unique.sql — one row per singer per goal, enforced.
--
-- `userAchievements` and `userBadges` are both logically keyed by
-- (userId, definitionId), and neither said so. The write path had to read the
-- table, decide INSERT or UPDATE per row, and then write — a read-then-write
-- with nothing between the two. Two tabs flushing in the same second both read
-- "no row for this goal" and both INSERT, and the singer ends up with two rows
-- for one achievement: whichever the next read happens to see wins, and the
-- other quietly disagrees about their progress forever.
--
-- Nothing in the app has ever wanted a second row here. So say it in the
-- schema, and the write collapses to a single upsert with no read in front of
-- it (see handleAchievementBulk) — the race is gone because there is no longer
-- a gap to race in.
--
-- Three steps, in this order, because a UNIQUE index cannot be created over
-- existing duplicates:
--
--   1. Merge each group onto its survivor, so a duplicate that held the unlock
--      does not take it to the grave.
--   2. Delete the non-survivors.
--   3. Add the index.
--
-- D1 runs a migration as one transaction, so this is all-or-nothing.

-- ── userAchievements ────────────────────────────────────────────────
--
-- Merge first: take the best of the group onto every member, so it does not
-- matter which one survives step 2. `unlocked` is a 0/1 integer, so MAX is
-- "unlocked if any of them was"; the earliest non-null unlockedAt is the one
-- that is actually true, since that is when they first earned it.
UPDATE userAchievements
   SET unlocked = (
         SELECT MAX(d.unlocked) FROM userAchievements d
          WHERE d.userId = userAchievements.userId
            AND d.achievementId = userAchievements.achievementId
       ),
       progress = (
         SELECT MAX(d.progress) FROM userAchievements d
          WHERE d.userId = userAchievements.userId
            AND d.achievementId = userAchievements.achievementId
       ),
       unlockedAt = (
         SELECT MIN(d.unlockedAt) FROM userAchievements d
          WHERE d.userId = userAchievements.userId
            AND d.achievementId = userAchievements.achievementId
            AND d.unlockedAt IS NOT NULL
       )
 WHERE EXISTS (
         SELECT 1 FROM userAchievements d
          WHERE d.userId = userAchievements.userId
            AND d.achievementId = userAchievements.achievementId
            AND d.id <> userAchievements.id
       );

-- Keep the oldest row of each group: its id is the one any client that cached
-- one is most likely to be holding.
DELETE FROM userAchievements
 WHERE id IN (
   SELECT id FROM (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY userId, achievementId
              ORDER BY createdAt ASC, id ASC
            ) AS rn
       FROM userAchievements
   ) WHERE rn > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_userAchievements_user_definition
  ON userAchievements(userId, achievementId);

-- ── userBadges ──────────────────────────────────────────────────────
--
-- Nothing to merge: a badge row carries no progress, only the moment it was
-- earned, and the earliest of those is the true one.
DELETE FROM userBadges
 WHERE id IN (
   SELECT id FROM (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY userId, badgeId
              ORDER BY earnedAt ASC, createdAt ASC, id ASC
            ) AS rn
       FROM userBadges
   ) WHERE rn > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_userBadges_user_definition
  ON userBadges(userId, badgeId);
