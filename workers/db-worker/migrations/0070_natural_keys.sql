-- 0070_natural_keys.sql — one row per setting, one per challenge, enforced.
--
-- `userSettings` is logically keyed by (userId, key) and `challengeProgress`
-- by (userId, challengeId), and neither said so. Their clients write
-- read-then-create: look for the row, create it when the read found none.
-- Two tabs, two devices, a retried POST or a read that came back short all
-- created a second row for the same thing. From then on a pull applied the
-- rows in whatever order they came back, so a device could take a stale
-- value over a newer one, and a challenge could show as active while a
-- second row held its completion and best score.
--
-- 0015 closed the same gap for userAchievements and userBadges. This does it
-- for these two, in the same three steps, because a UNIQUE index cannot be
-- created over existing duplicates:
--
--   1. Merge each group onto its survivor.
--   2. Delete the non-survivors.
--   3. Add the index.
--
-- With the index in place the generic create upserts on it (TableDef
-- `naturalKey` in workers/db-worker/src/tables.ts), so a create that meets an
-- existing row updates it: every client already installed stops making
-- duplicates, with no client change.
--
-- songManifests already has its index (0025: idx_songManifests_user_hash) and
-- only gains the upsert.
--
-- D1 runs a migration as one transaction, so this is all-or-nothing.

-- ── userSettings ────────────────────────────────────────────────────
--
-- Nothing to merge: a setting is one value, and the newest write is the one
-- the singer last chose. Keep the most recently updated row of each group.
-- A device that cached another row's id gets 404 on its next push, keeps the
-- value in its pending ledger, and re-learns the id from its next pull.
DELETE FROM userSettings
 WHERE id IN (
   SELECT id FROM (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY userId, "key"
              ORDER BY updatedAt DESC, createdAt DESC, id ASC
            ) AS rn
       FROM userSettings
   ) WHERE rn > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_userSettings_user_key
  ON userSettings(userId, "key");

-- ── challengeProgress ───────────────────────────────────────────────
--
-- Merge first: take the best of the group onto every member, so it does not
-- matter which one survives. `completed` is 0/1, so MAX is "completed if any
-- of them was", and then the status says so too. The earliest non-null
-- completedAt is the true one. Attempts take the largest count rather than
-- the sum: duplicates came from the same attempt being saved twice.
UPDATE challengeProgress
   SET completed = (
         SELECT MAX(d.completed) FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
       ),
       bestScore = (
         SELECT MAX(d.bestScore) FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
       ),
       progress = (
         SELECT MAX(d.progress) FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
       ),
       attempts = (
         SELECT MAX(d.attempts) FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
       ),
       completedAt = (
         SELECT MIN(d.completedAt) FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
            AND d.completedAt IS NOT NULL
       ),
       status = CASE
         WHEN (
           SELECT MAX(d.completed) FROM challengeProgress d
            WHERE d.userId = challengeProgress.userId
              AND d.challengeId = challengeProgress.challengeId
         ) = 1 THEN 'completed'
         ELSE status
       END
 WHERE EXISTS (
         SELECT 1 FROM challengeProgress d
          WHERE d.userId = challengeProgress.userId
            AND d.challengeId = challengeProgress.challengeId
            AND d.id <> challengeProgress.id
       );

-- Keep the oldest row of each group: its id is the one any client that cached
-- one is most likely to be holding.
DELETE FROM challengeProgress
 WHERE id IN (
   SELECT id FROM (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY userId, challengeId
              ORDER BY createdAt ASC, id ASC
            ) AS rn
       FROM challengeProgress
   ) WHERE rn > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_challengeProgress_user_challenge
  ON challengeProgress(userId, challengeId);
