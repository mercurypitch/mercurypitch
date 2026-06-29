-- =====================================================================
-- MercuryPitch Cloudflare D1 (SQLite) Schema — CLOUD TABLES ONLY
--
-- Storage split (see docs/plans/db-migration-plan.md):
--   CLOUD (this file): users, profiles, session scores, challenges,
--     badges, achievements, leaderboard, shared content, settings.
--   LOCAL ONLY (Dexie/IndexedDB, intentionally NOT in this schema):
--     uvrSessions, uvrStemBlobs, uvrStemFingerprints, uvrSessionLyrics,
--     offlinePitchAnalysis, whisperTranscriptions, sessionGroups,
--     melodyRecords, sessionTemplates, playlistRecords.
--   Karaoke/UVR audio blobs are huge and never sync to the cloud.
-- =====================================================================

-- ── Users (auth identity — see docs/plans/users-auth-plan.md) ────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  -- 'anonymous' users have no email/password; they can be upgraded
  -- to a real account later while keeping the same id.
  authProvider TEXT NOT NULL DEFAULT 'anonymous', -- 'anonymous' | 'password' | 'google' | 'github'
  providerId TEXT,
  email TEXT UNIQUE,
  emailVerified BOOLEAN NOT NULL DEFAULT 0,
  passwordHash TEXT,
  lastLoginAt TEXT,
  -- JWT revocation counter (see auth.ts): issued tokens carry `v`; logout
  -- increments this so older tokens fail the `getAuth` version check.
  -- Required by createUser/issueSession/getAuth — a fresh DB without it
  -- breaks register/login (table has no column named tokenVersion).
  tokenVersion INTEGER NOT NULL DEFAULT 1,
  -- Stripe customer id, set on first checkout (see billing.ts). NULL until
  -- the user starts a purchase. Existing DBs: see
  -- scripts/migrate-users-add-stripeCustomerId.sql.
  stripeCustomerId TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider
  ON users(authProvider, providerId) WHERE providerId IS NOT NULL;

-- ── User Profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS userProfiles (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  displayName TEXT NOT NULL,
  avatarUrl TEXT,
  bio TEXT,
  joinDate TEXT NOT NULL,
  lastPracticeDate TEXT,
  currentStreak INTEGER NOT NULL DEFAULT 0
);

-- ── Sessions & Practice Results (scores only — no audio) ────────────
CREATE TABLE IF NOT EXISTS sessionRecords (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  melodyId TEXT,
  melodyName TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT NOT NULL,
  score REAL NOT NULL,
  accuracy REAL NOT NULL,
  notesHit INTEGER NOT NULL,
  notesTotal INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  avgCents REAL,
  rating TEXT,
  results TEXT NOT NULL -- JSON
);

CREATE INDEX IF NOT EXISTS idx_sessionRecords_userId ON sessionRecords(userId);
CREATE INDEX IF NOT EXISTS idx_sessionRecords_endedAt ON sessionRecords(endedAt);

-- ── Challenges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challengeDefinitions (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  icon TEXT NOT NULL,
  targetScore REAL NOT NULL,
  rewardBadgeId TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challengeDefs_category ON challengeDefinitions(category);
CREATE INDEX IF NOT EXISTS idx_challengeDefs_sortOrder ON challengeDefinitions(sortOrder);

CREATE TABLE IF NOT EXISTS challengeProgress (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  challengeId TEXT NOT NULL,
  progress REAL NOT NULL,
  currentScore REAL NOT NULL,
  bestScore REAL NOT NULL,
  status TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT 0,
  completedAt TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_challengeProg_userId ON challengeProgress(userId);
CREATE INDEX IF NOT EXISTS idx_challengeProg_challengeId ON challengeProgress(challengeId);

-- ── Badges & Achievements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badgeDefinitions (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL,
  category TEXT NOT NULL,
  unlockCondition TEXT NOT NULL,
  sortOrder INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badgeDefs_category ON badgeDefinitions(category);
CREATE INDEX IF NOT EXISTS idx_badgeDefs_tier ON badgeDefinitions(tier);
CREATE INDEX IF NOT EXISTS idx_badgeDefs_sortOrder ON badgeDefinitions(sortOrder);

CREATE TABLE IF NOT EXISTS userBadges (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  badgeId TEXT NOT NULL,
  earnedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_userBadges_userId ON userBadges(userId);
CREATE INDEX IF NOT EXISTS idx_userBadges_badgeId ON userBadges(badgeId);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  points INTEGER NOT NULL,
  condition TEXT NOT NULL,
  required INTEGER NOT NULL,
  sortOrder INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_achievements_sortOrder ON achievements(sortOrder);

CREATE TABLE IF NOT EXISTS userAchievements (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  achievementId TEXT NOT NULL,
  progress REAL NOT NULL,
  unlocked BOOLEAN NOT NULL DEFAULT 0,
  unlockedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_userAch_userId ON userAchievements(userId);
CREATE INDEX IF NOT EXISTS idx_userAch_achievementId ON userAchievements(achievementId);

-- ── Leaderboard ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboardEntries (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  displayName TEXT NOT NULL,
  avatarUrl TEXT,
  category TEXT NOT NULL,
  period TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  streak INTEGER NOT NULL,
  totalSessions INTEGER NOT NULL,
  bestScore REAL NOT NULL,
  accuracy REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_userId ON leaderboardEntries(userId);
CREATE INDEX IF NOT EXISTS idx_leaderboard_category ON leaderboardEntries(category);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboardEntries(period);

-- ── Shared Content ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sharedMelodies (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  melodyId TEXT NOT NULL,
  melodyName TEXT NOT NULL,
  author TEXT NOT NULL,
  tags TEXT NOT NULL, -- JSON string array
  itemsJson TEXT NOT NULL, -- JSON
  isPublic BOOLEAN NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sharedMelodies_userId ON sharedMelodies(userId);
CREATE INDEX IF NOT EXISTS idx_sharedMelodies_melodyId ON sharedMelodies(melodyId);

CREATE TABLE IF NOT EXISTS sharedSessions (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  sessionName TEXT NOT NULL,
  author TEXT NOT NULL,
  score REAL NOT NULL,
  accuracy REAL NOT NULL,
  resultsJson TEXT NOT NULL, -- JSON
  isPublic BOOLEAN NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sharedSessions_userId ON sharedSessions(userId);
CREATE INDEX IF NOT EXISTS idx_sharedSessions_sessionId ON sharedSessions(sessionId);

-- ── Feature Flags ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS featureFlags (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  value BOOLEAN NOT NULL
);

-- ── User Settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS userSettings (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  "key" TEXT NOT NULL,
  value TEXT NOT NULL -- JSON
);

CREATE INDEX IF NOT EXISTS idx_userSettings_userId ON userSettings(userId);
CREATE INDEX IF NOT EXISTS idx_userSettings_key ON userSettings("key");

-- ── follows ──────────────────────────────────────────────────────────
-- Social graph: userId follows followedUserId. Private per-user rows
-- (access 'user'); the leaderboard endpoint joins it server-side for
-- the Friends view.
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  followedUserId TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_pair ON follows(userId, followedUserId);
CREATE INDEX IF NOT EXISTS idx_follows_userId ON follows(userId);

-- ── Onboarding survey ────────────────────────────────────────────────
-- Optional onboarding survey responses. answersJson holds the survey
-- payload ({ background?, usage?, featureRequest? }); access is 'user'
-- (rows are private to the submitting user). See tables.ts allowlist.
CREATE TABLE IF NOT EXISTS userSurveyResponses (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  answersJson TEXT NOT NULL, -- JSON
  submittedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_userSurveyResponses_userId ON userSurveyResponses(userId);

-- ── Billing: pricing, credits, entitlements (see src/billing.ts) ─────
-- Pricing is DB-driven so prices/tiers change without a deploy and no price
-- lives in the repo. `amount` is in minor units (e.g. cents); NULL renders
-- as "Soon" on the client and disables purchase. Seed rows (null amounts)
-- live in seed-pricing.sql.
CREATE TABLE IF NOT EXISTS pricingPlans (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  kind TEXT NOT NULL,              -- 'tier' | 'pack'
  label TEXT NOT NULL,
  description TEXT,
  unit TEXT,                       -- e.g. 'song' (tiers)
  amount INTEGER,                  -- minor units; NULL = price not set ("Soon")
  currency TEXT NOT NULL DEFAULT 'eur',
  credits INTEGER,                 -- credits granted (packs)
  stripePriceId TEXT,              -- wired in Stripe later
  badge TEXT,                      -- e.g. 'Default', 'Beta 2x'
  sortOrder INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pricingPlans_kind ON pricingPlans(kind);

-- Append-only credit ledger; a user's balance is SUM(delta). `delta` is
-- positive for grants (purchase) and negative for debits (a paid job).
-- idempotencyKey makes grants/debits safe to retry (webhook redelivery,
-- job retries) — a duplicate key is ignored, never double-counted.
CREATE TABLE IF NOT EXISTS creditLedger (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  jobRef TEXT,
  idempotencyKey TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_creditLedger_userId ON creditLedger(userId);

-- Per-user feature grants (e.g. a subscription entitlement), mirrored from
-- Stripe webhooks. expiresAt NULL = no expiry.
CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  feature TEXT NOT NULL,
  source TEXT,
  expiresAt TEXT,
  UNIQUE(userId, feature)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_userId ON entitlements(userId);

-- Processed Stripe event ids — webhook idempotency. An event id already
-- present here is acknowledged and skipped (Stripe retries deliveries).
CREATE TABLE IF NOT EXISTS billingEvents (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  type TEXT
);

-- ── Auth rate limiting ───────────────────────────────────────────────
-- Per-IP, per-endpoint counters for the auth POST endpoints (see auth.ts).
-- The PRIMARY KEY (ip, endpoint) is the conflict target for the atomic
-- upsert in checkRateLimit(). Counters are short-lived (reset once the
-- window elapses); rows are harmless if they linger.
CREATE TABLE IF NOT EXISTS auth_ratelimit (
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  windowStart INTEGER NOT NULL,
  PRIMARY KEY (ip, endpoint)
);
