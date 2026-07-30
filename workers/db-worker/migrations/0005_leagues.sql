-- 0005 — weekly-league foundation: rungs, cohorts, membership, point weights.
--
-- Duolingo-style weekly promotion ladder (see the league plan doc). This is
-- the DATA foundation only: no request path writes these tables yet — the
-- points award, weekly cut cron, API, and UI land in follow-up changes, so
-- everything here is inert until they do.
--
-- League config is DB-driven (like pricingPlans / leaderboardConfig): rung
-- names, trophy art, promote/relegate counts, and point weights are all
-- admin-editable without a deploy.
--
-- ELIGIBILITY (enforced later, on the award/cut request path — not here):
-- leagues are REGISTERED-users only (users.authProvider != 'anonymous').

-- The rung a user sits on between weekly cuts.
ALTER TABLE userProfiles ADD COLUMN currentLeagueId TEXT NOT NULL DEFAULT 'l1';

-- Seven ascending league rungs (config-driven, admin-editable).
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,                    -- 'l1'..'l7'
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  rank INTEGER NOT NULL UNIQUE,           -- 1..7, ascending
  name TEXT NOT NULL,                     -- branded rung name ('???' while mystery)
  -- Two assets per rung, because they do different jobs. trophyAsset is the
  -- hero sculpture for the big rung card; badgeAsset is the enamel pin used
  -- wherever the art renders small (the ladder strip is 56px, where a
  -- photoreal glass trophy turns to mush). Falls back to trophyAsset if NULL.
  trophyAsset TEXT,                       -- '/leagues/lN.*' or R2 URL; NULL = no art yet
  badgeAsset TEXT,                        -- '/leagues/lN-badge.*'; NULL = fall back to trophyAsset
  isMystery INTEGER NOT NULL DEFAULT 0,   -- 1 = locked "coming soon" rung (l7)
  promoteCount INTEGER NOT NULL,          -- top N of a cohort promote up a rung
  relegateCount INTEGER NOT NULL          -- bottom M relegate down a rung (0 = safe)
);

-- One league instance per ISO week (one global cohort per league/week at launch).
CREATE TABLE IF NOT EXISTS leagueCohorts (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  leagueId TEXT NOT NULL,
  weekStart TEXT NOT NULL,
  UNIQUE(leagueId, weekStart)
);

CREATE INDEX IF NOT EXISTS idx_leagueCohorts_week ON leagueCohorts(weekStart);

-- A user's standing in the current ISO week (points reset each Monday).
CREATE TABLE IF NOT EXISTS leagueMembership (
  id TEXT PRIMARY KEY,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  cohortId TEXT NOT NULL,
  weekStart TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  UNIQUE(userId, weekStart)
);

CREATE INDEX IF NOT EXISTS idx_leagueMembership_standings
  ON leagueMembership(cohortId, points DESC);

-- Append-only audit of every points award (server-written).
CREATE TABLE IF NOT EXISTS leaguePointEvents (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  weekStart TEXT NOT NULL,
  source TEXT NOT NULL,
  points INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaguePointEvents_user
  ON leaguePointEvents(userId, weekStart);

-- Single-row tunable point weights (mirrors src/league-points.ts defaults).
CREATE TABLE IF NOT EXISTS leaguePointsConfig (
  id TEXT PRIMARY KEY,                              -- always 'default' (single row)
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  exerciseBase INTEGER NOT NULL DEFAULT 10,
  challengeBase INTEGER NOT NULL DEFAULT 15,
  weeklyBase INTEGER NOT NULL DEFAULT 20,
  scoreDivisor INTEGER NOT NULL DEFAULT 10,
  dailyVarietyBonus INTEGER NOT NULL DEFAULT 5,
  goalMetBonus INTEGER NOT NULL DEFAULT 25,
  streakMilestoneBonus INTEGER NOT NULL DEFAULT 50,
  milestoneEvery INTEGER NOT NULL DEFAULT 7,
  -- Abuse ceiling: how many base-earning session completions (exercise /
  -- challenge / weekly) can score league points per user per UTC day. The
  -- record itself always saves; past the cap it just stops paying, which
  -- bounds what a scripted client can farm to one honest day's worth.
  dailyScoredSessionCap INTEGER NOT NULL DEFAULT 30
);

-- Seed the 7 rungs (Merc mascot family). l1 is a grace rung (relegateCount 0);
-- l6 is the top playable rung (promoteCount 0 — l7 is locked); l7 is the
-- mystery (0/0), shipped with teaser art but flagged isMystery so the client
-- renders it as locked.
--
-- The l1–l6 trophies are one sculpture family reading as a note-duration
-- ladder: quarter, half, whole, two beamed, four beamed, and the Sung Note at
-- the top. Longer note = higher rung, so the art itself teaches the order.
-- Each rung also carries its own gem colour (bronze, platinum, gold, emerald,
-- amethyst, sapphire) so a rung stays identifiable at the ~40px it renders in
-- a standings row, where counting note-heads is not realistic.
INSERT OR IGNORE INTO leagues
  (id, createdAt, updatedAt, rank, name, trophyAsset, badgeAsset, isMystery, promoteCount, relegateCount)
VALUES
  ('l1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 1, 'Mercling',  '/leagues/l1.webp', '/leagues/l1-badge.webp', 0, 15, 0),
  ('l2', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 2, 'Sparkwing', '/leagues/l2.webp', '/leagues/l2-badge.webp', 0, 10, 10),
  ('l3', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 3, 'Skyvox',    '/leagues/l3.webp', '/leagues/l3-badge.webp', 0, 10, 10),
  ('l4', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 4, 'Highnova',  '/leagues/l4.webp', '/leagues/l4-badge.webp', 0, 10, 10),
  ('l5', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 5, 'Starcrest', '/leagues/l5.webp', '/leagues/l5-badge.webp', 0, 10, 10),
  ('l6', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 6, 'Mercapex',  '/leagues/l6.webp', '/leagues/l6-badge.webp', 0, 0,  10),
  -- l7 has no badge yet: it renders locked, and the reveal art is held back.
  ('l7', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 7, '???',       '/leagues/l7.webp', NULL, 1, 0,  0);

-- Seed the single tunable points-config row (all weights default).
INSERT OR IGNORE INTO leaguePointsConfig
  (id, createdAt, updatedAt)
VALUES
  ('default', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Single-row bookkeeping for the weekly cut (server-written only, not in the
-- CRUD allowlist). lastCutWeekStart marks the week the cron has already
-- processed, so a 6-hourly cron firing many times per week applies the
-- promotion/relegation pass exactly once.
CREATE TABLE IF NOT EXISTS leagueMeta (
  id TEXT PRIMARY KEY,        -- always 'default' (single row)
  updatedAt TEXT NOT NULL,
  lastCutWeekStart TEXT       -- ISO Monday of the most recent week already cut
);

INSERT OR IGNORE INTO leagueMeta (id, updatedAt, lastCutWeekStart)
VALUES ('default', '2026-01-01T00:00:00.000Z', NULL);
