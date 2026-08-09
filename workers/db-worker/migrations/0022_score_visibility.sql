-- 0022_score_visibility.sql — reversible operator controls for scoreboards.
--
-- The main leaderboard override lives on users because it is account-wide and
-- must win over the singer-controlled userProfiles.leaderboardOptIn setting.
-- Weekly challenge retractions are keyed by challenge + user because a board
-- is derived from every matching sessionRecord rather than from one score row.
-- Source sessions are never deleted. Every real transition is copied to the
-- append-only scoreVisibilityEvents table before its current state changes.

ALTER TABLE users ADD COLUMN leaderboardExcludedAt TEXT;
ALTER TABLE users ADD COLUMN leaderboardExclusionReason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_leaderboardExcludedAt
  ON users(leaderboardExcludedAt) WHERE leaderboardExcludedAt IS NOT NULL;

CREATE TABLE IF NOT EXISTS weeklyChallengeScoreRetractions (
  weeklyChallengeId TEXT NOT NULL,
  userId TEXT NOT NULL,
  retractedAt TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (weeklyChallengeId, userId),
  FOREIGN KEY (weeklyChallengeId) REFERENCES weeklyChallenges(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weeklyScoreRetractions_user
  ON weeklyChallengeScoreRetractions(userId, retractedAt DESC);

CREATE TABLE IF NOT EXISTS scoreVisibilityEvents (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('leaderboard', 'weekly-challenge')),
  weeklyChallengeId TEXT,
  action TEXT NOT NULL CHECK (action IN ('exclude', 'retract', 'restore')),
  reason TEXT NOT NULL,
  CHECK (
    (scope = 'leaderboard' AND weeklyChallengeId IS NULL AND action IN ('exclude', 'restore'))
    OR
    (scope = 'weekly-challenge' AND weeklyChallengeId IS NOT NULL AND action IN ('retract', 'restore'))
  ),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scoreVisibilityEvents_user_created
  ON scoreVisibilityEvents(userId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_scoreVisibilityEvents_weekly_created
  ON scoreVisibilityEvents(weeklyChallengeId, createdAt DESC)
  WHERE weeklyChallengeId IS NOT NULL;
