-- 0004 — leaderboardConfig: who ranks, and what it takes to be published.
--
-- Config rather than constants because the right thresholds are a product
-- judgement to tune against real numbers. Public reads (the client shows the
-- rules it will be judged by); writes require the X-Admin-Key, same as
-- pricingPlans. A single row, id = 'default'; an absent row means the
-- conservative defaults compiled into the worker.

CREATE TABLE IF NOT EXISTS leaderboardConfig (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  -- JSON array of sessionRecords.source values that may rank. Free
  -- 'practice' is excluded: scores over self-chosen melodies aren't
  -- comparable between people.
  eligibleSources TEXT NOT NULL DEFAULT '["challenge","weekly","exercise"]',
  -- Best-ever streak needed before a user may be published at all. Read from
  -- longestStreak, not the current streak: qualifying is earned once, so a
  -- week off neither drops you nor silently republishes you on return.
  minStreakDays INTEGER NOT NULL DEFAULT 3,
  -- Eligible attempts required before ranking (the "provisional rating"
  -- convention — one lucky run shouldn't top a board).
  minSessions INTEGER NOT NULL DEFAULT 1,
  -- When 1, a qualifying user must also have opted in.
  requireOptIn INTEGER NOT NULL DEFAULT 1
);
