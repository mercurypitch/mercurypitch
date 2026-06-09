-- =====================================================================
-- MercuryPitch Cloudflare D1 (SQLite) Schema
-- Generated to match src/db/entities.ts and dexie-adapter.ts 1:1
-- =====================================================================

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

-- ── Sessions & Practice Results ──────────────────────────────────────
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

-- ── Melody Library (Local -> Cloud prep) ─────────────────────────────
CREATE TABLE IF NOT EXISTS melodyRecords (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  author TEXT,
  bpm REAL NOT NULL,
  "key" TEXT NOT NULL,
  scaleType TEXT NOT NULL,
  octave INTEGER NOT NULL,
  playCount INTEGER NOT NULL DEFAULT 0,
  lastPlayed INTEGER,
  itemsJson TEXT NOT NULL, -- JSON
  tags TEXT,
  notes TEXT,
  isDeleted BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessionTemplates (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  author TEXT,
  difficulty TEXT,
  category TEXT,
  description TEXT,
  itemsJson TEXT NOT NULL, -- JSON
  deletable BOOLEAN NOT NULL DEFAULT 1,
  lastPlayed INTEGER,
  isDeleted BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS playlistRecords (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  melodyIds TEXT NOT NULL -- JSON array
);

-- ── UVR & Pitch Analysis ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uvrSessions (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  appSessionId TEXT NOT NULL,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL,
  indeterminate BOOLEAN,
  fileHash TEXT,
  originalFileName TEXT NOT NULL,
  originalFileSize INTEGER NOT NULL,
  originalFileType TEXT NOT NULL,
  processingMode TEXT NOT NULL,
  provider TEXT,
  numChunks INTEGER,
  processingTime REAL,
  error TEXT,
  vocalStemId TEXT,
  instrumentalStemId TEXT,
  originalFileBlobId TEXT,
  stemMetaJson TEXT, -- JSON
  appCreatedAt INTEGER,
  groupId TEXT
);

CREATE INDEX IF NOT EXISTS idx_uvrSessions_appSessionId ON uvrSessions(appSessionId);
CREATE INDEX IF NOT EXISTS idx_uvrSessions_userId ON uvrSessions(userId);
CREATE INDEX IF NOT EXISTS idx_uvrSessions_status ON uvrSessions(status);
CREATE INDEX IF NOT EXISTS idx_uvrSessions_fileHash ON uvrSessions(fileHash);
CREATE INDEX IF NOT EXISTS idx_uvrSessions_createdAt ON uvrSessions(createdAt);

CREATE TABLE IF NOT EXISTS uvrStemBlobs (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  stemType TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  data BLOB NOT NULL, -- NOTE: Avoid exceeding 1MB in D1! R2 is recommended.
  size INTEGER NOT NULL,
  fileName TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uvrStemBlobs_sessionId ON uvrStemBlobs(sessionId);
CREATE INDEX IF NOT EXISTS idx_uvrStemBlobs_stemType ON uvrStemBlobs(stemType);
CREATE INDEX IF NOT EXISTS idx_uvrStemBlobs_createdAt ON uvrStemBlobs(createdAt);

CREATE TABLE IF NOT EXISTS uvrStemFingerprints (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  fingerprintJson TEXT NOT NULL -- JSON
);

CREATE INDEX IF NOT EXISTS idx_uvrStemFp_sessionId ON uvrStemFingerprints(sessionId);
CREATE INDEX IF NOT EXISTS idx_uvrStemFp_createdAt ON uvrStemFingerprints(createdAt);

CREATE TABLE IF NOT EXISTS sessionGroups (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  sessionIds TEXT NOT NULL -- JSON string array
);

CREATE TABLE IF NOT EXISTS uvrSessionLyrics (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  text TEXT NOT NULL,
  format TEXT NOT NULL,
  filename TEXT NOT NULL,
  wordTimingsJson TEXT, -- JSON
  originalText TEXT,
  blocksJson TEXT, -- JSON
  blockInstancesJson TEXT, -- JSON
  fontSize REAL
);

CREATE INDEX IF NOT EXISTS idx_uvrSessionLyrics_sessionId ON uvrSessionLyrics(sessionId);

CREATE TABLE IF NOT EXISTS offlinePitchAnalysis (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  fileHash TEXT NOT NULL,
  analysisResultsJson TEXT NOT NULL, -- JSON
  lrcLinesJson TEXT NOT NULL, -- JSON
  segmentedNotesJson TEXT NOT NULL -- JSON
);

CREATE INDEX IF NOT EXISTS idx_offlinePitch_fileHash ON offlinePitchAnalysis(fileHash);

CREATE TABLE IF NOT EXISTS whisperTranscriptions (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  segmentsJson TEXT NOT NULL, -- JSON
  segmentCount INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whisper_sessionId ON whisperTranscriptions(sessionId);
