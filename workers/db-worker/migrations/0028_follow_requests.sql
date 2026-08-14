-- ── Follow requests ──────────────────────────────────────────────────
-- A follow row used to be enough, on its own, to read someone's streak and
-- score aggregates through the leaderboard's Friends view. Anyone could
-- create one: POST /api/follows forces userId to the caller, but
-- followedUserId was whatever the caller sent. So A could follow B without
-- B agreeing and then read B's numbers, including for a B who had never
-- opted in to the leaderboard at all.
--
-- The friend-code path already had this right: redeeming a code inserts BOTH
-- directions, because being given the code IS the consent. This makes that
-- the rule everywhere — a follow is a request until the other side accepts.
--
-- Existing rows cannot be told apart by origin, but they can by shape: a
-- reciprocal pair was consensual (it can only have come from a friend code),
-- a lone row was not. Pairs become 'accepted'; lone rows become 'pending',
-- which is exactly the set that was never agreed to.

ALTER TABLE follows ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Reciprocal pairs are friend-code redemptions. Accept them.
UPDATE follows
SET status = 'accepted'
WHERE EXISTS (
  SELECT 1 FROM follows AS other
  WHERE other.userId = follows.followedUserId
    AND other.followedUserId = follows.userId
);

-- The Friends view filters on (userId, status), and the accept path looks a
-- row up by its reverse pair.
CREATE INDEX IF NOT EXISTS idx_follows_user_status
  ON follows(userId, status);
CREATE INDEX IF NOT EXISTS idx_follows_followed_status
  ON follows(followedUserId, status);
