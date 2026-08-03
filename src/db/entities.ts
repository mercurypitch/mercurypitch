// ============================================================
// Database Entity Definitions
// ============================================================
//
// Each entity extends DbEntity (id, createdAt, updatedAt).
// Entity names match the repository keys used with getRepository().

import type { DbEntity } from './types'

// ── User & Profile ──────────────────────────────────────────────

export interface UserProfile extends DbEntity {
  displayName: string
  avatarUrl?: string
  bio?: string
  joinDate: string // ISO 8601
  lastPracticeDate: string | null // ISO 8601 date-only (YYYY-MM-DD)
  currentStreak: number
  // Streak forgiveness (added 2026-07: freeze + repair). All optional so
  // existing rows and older clients keep working; treated as 0/null when absent.
  longestStreak?: number
  /** Unspent streak freezes; a 1-day gap auto-consumes one instead of resetting. */
  streakFreezes?: number
  lastFreezeUsedDate?: string | null // YYYY-MM-DD
  /** Streak value just before the most recent reset — restorable via repair. */
  previousStreak?: number
  /** When the streak last reset to 1 (drives the 72h repair window). */
  streakResetDate?: string | null // YYYY-MM-DD
  lastRepairDate?: string | null // YYYY-MM-DD (repair allowed once per 30 days)
  /**
   * Consent to appear on the public leaderboard. Off unless explicitly set:
   * qualifying on activity is necessary but not sufficient — nobody is
   * published without saying yes.
   */
  leaderboardOptIn?: boolean
  leaderboardOptInAt?: string | null
  /** Shareable friend code (registered accounts only; server-minted). */
  friendCode?: string | null
}

// ── Sessions & Practice Results ─────────────────────────────────

export interface NoteResultRecord {
  noteIndex: number
  noteName: string
  octave: number
  midi: number
  cents: number
  hit: boolean
  score: number
  avgCents: number
}

export interface PracticeResultRecord {
  score: number
  noteCount: number
  avgCents: number
  itemsCompleted: number
  totalItems?: number
  name: string
  mode: string
  completedAt: number
  noteResult: NoteResultRecord[]
}

/**
 * What kind of attempt produced a SessionRecord. Only fixed tasks are
 * publicly ranked — 'practice' is free singing over a self-chosen melody,
 * which is not comparable between people (see leaderboardConfig).
 */
export type SessionSource = 'practice' | 'challenge' | 'weekly' | 'exercise'

export interface SessionRecord extends DbEntity {
  userId: string
  melodyId?: string
  melodyName: string
  startedAt: string
  endedAt: string
  score: number // 0-100
  accuracy: number // 0-100
  notesHit: number
  notesTotal: number
  streak: number
  avgCents?: number
  rating?: string
  /** Set when this attempt was a weekly "Sing the Legend" challenge take. */
  weeklyChallengeId?: string
  /** Drives leaderboard eligibility. Older rows predate it — treat as 'practice'. */
  source?: SessionSource
  results: PracticeResultRecord[]
}

// ── Zen Singing Takes ───────────────────────────────────────────

/**
 * Local-only snapshot of one completed Zen canvas pass. The pitch contour is
 * stored as compact positional tuples in traceJson; it is never routed through
 * the cloud adapter.
 */
export interface ZenTakeRecord extends DbEntity {
  mode: 'monitor' | 'exercise'
  takeNumber: number
  exerciseId?: string
  exerciseVersion?: number
  rootMidi?: number
  completedAt: number
  durationSec: number
  traceVersion: 1
  traceJson: string
  viewportMinMidi: number
  viewportMaxMidi: number
  scoreTotal?: number
  scorePitch?: number
  scoreCoverage?: number
  scoreSteadiness?: number
  scoreAverageCents?: number
}

// ── Voiceprints ─────────────────────────────────────────────────

/** Where a voiceprint was measured. */
export type VoiceprintSource = 'onboarding' | 'mirror'

/**
 * A singer's measured voice at one moment: range, accuracy, steadiness,
 * and the legend their range overlaps with.
 *
 * Derived numbers only — no audio and no pitch frames. `takenAt` is when
 * they actually sang, which may predate `createdAt` for a take made
 * anonymously and uploaded on sign-in.
 */
export interface Voiceprint extends DbEntity {
  userId: string
  /** JSON-encoded MirrorSummary (src/lib/mirror/metrics.ts). */
  summary: {
    lowMidi: number | null
    highMidi: number | null
    semitones: number | null
    accuracy: number | null
    steadiness: number | null
  }
  /** e.g. 'Freddie Mercury'; absent when no range was measured. */
  twin?: string
  source: VoiceprintSource
  takenAt: string
}

// ── Challenges ──────────────────────────────────────────────────

export type ChallengeCategory =
  | 'basics'
  | 'high-notes'
  | 'low-notes'
  | 'speed'
  | 'perfect'
  | 'scales'
  | 'intervals'
  | 'harmony'
  | 'agility'
  | 'range'
  | 'dynamic'
  | 'call-response'

export interface ChallengeDefinition extends DbEntity {
  category: ChallengeCategory
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  icon: string // emoji
  targetScore: number
  rewardBadgeId?: string
  isActive: boolean
  sortOrder: number
}

export interface ChallengeProgress extends DbEntity {
  userId: string
  challengeId: string
  progress: number // 0-100
  currentScore: number
  bestScore: number
  status: 'locked' | 'active' | 'completed'
  completed: boolean
  completedAt?: string
  attempts: number
}

// ── Badges & Achievements ───────────────────────────────────────

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface BadgeDefinition extends DbEntity {
  name: string
  description: string
  icon: string
  tier: BadgeTier
  category: string
  unlockCondition: string
  sortOrder: number
}

export interface UserBadge extends DbEntity {
  userId: string
  badgeId: string
  earnedAt: string
}

/**
 * Which shelf an achievement sits on.
 *
 * - `beginnings` — first-time acts. A new singer clears several in week one.
 * - `building` — the weekly rhythm, for someone already practising.
 * - `mastery` — the long haul, months rather than weeks.
 *
 * The point of the split is that there is always one within reach while
 * the far ones stay visible.
 */
export type AchievementCategory = 'beginnings' | 'building' | 'mastery'

export interface Achievement extends DbEntity {
  name: string
  description: string
  icon: string
  points: number
  condition: string
  required: number
  sortOrder: number
  /** Older rows predate the column — treat a missing value as 'beginnings'. */
  category?: AchievementCategory
}

export interface UserAchievement extends DbEntity {
  userId: string
  achievementId: string
  progress: number // 0-100
  unlocked: boolean
  unlockedAt?: string
}

// ── Leaderboard ─────────────────────────────────────────────────

export type LeaderboardCategory =
  | 'overall'
  | 'best-score'
  | 'accuracy'
  | 'streak'
  | 'sessions'
export type LeaderboardPeriod = 'all-time' | 'weekly' | 'monthly'

export interface LeaderboardEntry extends DbEntity {
  userId: string
  displayName: string
  avatarUrl?: string
  category: LeaderboardCategory
  period: LeaderboardPeriod
  rank: number
  score: number
  streak: number
  /** Best streak ever reached — what the "Longest Streak" board ranks on. */
  longestStreak?: number
  totalSessions: number
  bestScore: number
  accuracy: number
}

// ── Leagues (weekly promotion ladder) ───────────────────────────
// Foundation data model for the Duolingo-style weekly league (see
// docs — league-system-plan). League config lives in `leagues` rows
// (admin-editable); cohorts/membership/point-events are server-written
// only. Leagues are a REGISTERED-users-only surface (enforced on the
// award/cut request path, not in these types).

/** One of the seven ascending league rungs (l1..l7); l7 is the mystery. */
export interface League extends DbEntity {
  rank: number // 1..7, ascending
  name: string // branded rung name; '???' while a mystery
  /** Hero sculpture for the rung card ('/leagues/lN.webp' or R2 key). */
  trophyAsset: string | null
  /** Flat enamel badge for small sizes; null falls back to trophyAsset. */
  badgeAsset: string | null
  /** True for a locked "coming soon" rung (l7) until it is revealed. */
  isMystery: boolean
  promoteCount: number // top N of a cohort promote up a rung
  relegateCount: number // bottom M relegate down a rung (0 = safe rung)
}

/**
 * A league instance for one ISO week (one global cohort per league/week at
 * launch). Immutable once minted, so it carries `createdAt` but no
 * `updatedAt` — hence it does not extend {@link DbEntity}.
 */
export interface LeagueCohort {
  id: string
  createdAt: string // ISO 8601
  leagueId: string
  weekStart: string // ISO Monday 00:00 UTC
}

/**
 * A user's standing in the current ISO week. Created then mutated in place as
 * points accrue, so it carries `updatedAt` but no `createdAt` — hence it does
 * not extend {@link DbEntity}. `points` resets to 0 each Monday.
 */
export interface LeagueMembership {
  id: string
  updatedAt: string // ISO 8601
  userId: string
  cohortId: string
  weekStart: string // ISO Monday 00:00 UTC
  points: number
}

/**
 * The single-row (id='default') tunable point weights. Mirrors the pure
 * calculator's config in workers/db-worker/src/league-points.ts (which omits
 * these DbEntity bookkeeping fields).
 */
export interface LeaguePointsConfig extends DbEntity {
  exerciseBase: number
  challengeBase: number
  weeklyBase: number
  scoreDivisor: number
  dailyVarietyBonus: number
  goalMetBonus: number
  streakMilestoneBonus: number
  milestoneEvery: number
}

// ── Shared Content ──────────────────────────────────────────────

export interface SharedMelody extends DbEntity {
  userId: string
  melodyId: string
  melodyName: string
  author: string
  tags: string[]
  itemsJson: string // serialized MelodyItem[]
  isPublic: boolean
}

export interface SharedSession extends DbEntity {
  userId: string
  sessionId: string
  sessionName: string
  author: string
  score: number
  accuracy: number
  resultsJson: string // serialized results array
  isPublic: boolean
}

// ── Feature Flags ───────────────────────────────────────────────

export interface FeatureFlag extends DbEntity {
  key: string
  value: boolean
}

// ── User Settings (cloud-synced when signed in) ─────────────────

export interface UserSetting extends DbEntity {
  userId: string
  key: string
  value: string // JSON-serialized
}

// ── Follows (social graph for the Friends leaderboard) ──────────

export interface Follow extends DbEntity {
  userId: string
  followedUserId: string
}

// ── Melody Library (entity types ready for future migration) ────

export interface MelodyRecord extends DbEntity {
  name: string
  author?: string
  bpm: number
  key: string
  scaleType: string
  octave: number
  playCount: number
  lastPlayed?: number
  itemsJson: string // serialized MelodyItem[]
  tags?: string
  notes?: string
  isDeleted: boolean
}

export interface SessionTemplate extends DbEntity {
  name: string
  author?: string
  difficulty?: string
  category?: string
  description?: string
  itemsJson: string // serialized SessionItem[]
  deletable: boolean
  lastPlayed?: number
  isDeleted: boolean
}

export interface PlaylistRecord extends DbEntity {
  name: string
  description?: string
  melodyIds: string // JSON array of melody IDs
}

// ── UVR Sessions & Stem Blobs ────────────────────────────────────

export interface UvrSessionRecord extends DbEntity {
  appSessionId: string // matches UvrSession.sessionId from app-store
  userId: string
  /** RunPod job session id (`rp_<tier>_<jobId>`) for server-mode jobs. Kept
   *  so a reload can re-attach to an in-flight job and re-fetch its stems
   *  (RunPod result ~30 min; R2 stems ~24 h) instead of orphaning it and
   *  re-charging a fresh separation. Absent for local (on-device) jobs. */
  apiSessionId?: string
  status: string // 'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled' | 'interrupted'
  progress: number
  indeterminate?: boolean
  fileHash?: string // SHA-256 hex digest of the original file
  originalFileName: string
  originalFileSize: number
  originalFileType: string
  processingMode: string // 'server' | 'local'
  provider?: string
  numChunks?: number
  processingTime?: number
  /** Wall-clock ms of the instrumental-split second pass (drums/bass/…). */
  splitTime?: number
  /** RunPod session id of an IN-FLIGHT instrumental split — persisted
   *  before polling (like apiSessionId for the main separation) so a
   *  reload re-attaches instead of orphaning the paid job. Cleared when
   *  the split settles. */
  splitApiSessionId?: string
  error?: string
  vocalStemId?: string // FK -> uvrStemBlobs.id
  instrumentalStemId?: string
  originalFileBlobId?: string // FK -> uvrStemBlobs.id
  /** JSON-serialized Record<string, { duration?: number; size?: number }> */
  stemMetaJson?: string
  /** Timestamp from the original UvrSession.createdAt (epoch ms) */
  appCreatedAt?: number
  /** Optional group assignment */
  groupId?: string
}

/** Every stem a blob row can hold. 'original' is the uploaded source file;
 *  the part stems (drums/bass/guitar/piano/other) come from splitting the
 *  instrumental. Dexie indexes stemType as a plain index, so widening this
 *  union needs no schema migration. */
export type UvrStemType =
  | 'vocal'
  | 'instrumental'
  | 'original'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'other'

export interface UvrStemBlob extends DbEntity {
  sessionId: string // matches UvrSession.sessionId from app-store
  stemType: UvrStemType
  /** Stem this one was derived from — 'instrumental' for the part stems
   *  produced by splitting it into drums/bass/guitar/other. */
  derivedFrom?: UvrStemType
  /** Server registry model that produced it (e.g. 'demucs-6s'). */
  producedBy?: string
  mimeType: string // 'audio/wav' | 'audio/mpeg'
  data: ArrayBuffer // binary audio data
  size: number // byte size
  fileName: string
}

export interface UvrStemFingerprint extends DbEntity {
  sessionId: string // matches UvrSession.sessionId
  fingerprintJson: string // JSON-serialized MelodyFingerprint
}

export interface SessionGroupRecord extends DbEntity {
  name: string
  sessionIds: string[] // ordered list of UvrSession.sessionId values
}

/** One entry in a karaoke playlist — either a single session or a whole group. */
export interface KaraokePlaylistItem {
  id: string
  kind: 'session' | 'group'
  /** UvrSession.sessionId (kind==='session') | SessionGroupRecord.id (kind==='group') */
  refId: string
  /** "Who will do this song" — shown in the overlay/header/scoreboard. */
  singerName?: string
  /** Shuffle the order of sessions within the group when played. */
  shuffleWithinGroup?: boolean
  /**
   * This singer's preferred vocal-stem level (0–1), pre-applied to every song
   * of this entry before it starts. Unset = the stage's default vocal mix.
   */
  vocalVolume?: number
}

/** A saved, reusable karaoke set list built from sessions and/or groups. */
export interface KaraokePlaylistRecord extends DbEntity {
  name: string
  items: KaraokePlaylistItem[] // ordered
  /** Shuffle the top-level item order on play (in round-robin, re-shuffles the
   *  group turn order each round). */
  shuffleOrder?: boolean
  /**
   * Playback order:
   * - 'sequential' (default): play each group/song fully, in order.
   * - 'roundRobin': take one song per group per round (turn-based), until all
   *   songs are played. Standalone sessions count as a one-song group.
   */
  playMode?: 'sequential' | 'roundRobin'
}

export interface UvrSessionLyrics extends DbEntity {
  sessionId: string // matches UvrSession.sessionId
  text: string
  format: 'txt' | 'lrc'
  filename: string
  /** JSON-serialized WordTimingsMap */
  wordTimingsJson?: string
  originalText?: string
  /** JSON-serialized LyricsBlock[] */
  blocksJson?: string
  /** JSON-serialized BlockInstancesMap */
  blockInstancesJson?: string
  fontSize?: number
  /** JSON-serialized LyricsVersion[] — the named mappings (Original / Edited
   *  / Auto-sync / Tapped). Absent on legacy rows; migrated on load. */
  versionsJson?: string
  /** Active version's kind (LyricsVersionKind). */
  activeVersionKind?: string
}

export interface OfflinePitchAnalysisRecord extends DbEntity {
  fileHash: string
  analysisResultsJson: string
  lrcLinesJson: string
  segmentedNotesJson: string
  /** JSON-serialized PitchEditLayer (manual note edits). Optional for
   *  backward-compat with rows written before edit mode. Non-indexed payload,
   *  so no Dexie schema bump is required. */
  editLayerJson?: string
  /** JSON-serialized KeyRegion[] — detected per-region keys for the vocal. */
  keyRegionsJson?: string
}

export interface WhisperTranscriptionRecord extends DbEntity {
  sessionId: string
  /** JSON-serialized WhisperSegment[] */
  segmentsJson: string
  /** Number of segments for quick stats */
  segmentCount: number
}

// ── Onboarding Survey ─────────────────────────────────────────

/**
 * One thing a singer DID, appended and never edited.
 *
 * The profile can already describe scores — sessionRecords carries them.
 * It cannot describe an act that leaves no practice session behind:
 * making a playlist, finishing one start to finish, separating stems.
 * That is what this is for, and only that. Anything derivable from
 * sessionRecords stays derived from it, so there is one source of truth
 * per question.
 *
 * Deliberately not mirrorEvents: that table is the growth funnel, keyed
 * by device rather than person and read from the ops console. The two
 * answer different questions and must not be collapsed.
 */
export type UserActivityKind =
  | 'playlist_created'
  | 'playlist_completed'
  | 'song_completed'
  | 'stems_separated'
  | 'melody_created'
  | 'ascent_week_completed'

export interface UserActivity extends DbEntity {
  userId: string
  kind: UserActivityKind
  /** What was acted on. Not a foreign key — deleting a playlist does not
   *  un-make the act of having made it. */
  refId?: string
  /** Per-kind detail (song count, duration). Never queried structurally. */
  metaJson?: string
  /** When it happened, which is not always when it synced. */
  at: string
}

export interface UserSurveyResponse extends DbEntity {
  userId: string
  /** JSON: { background?: string[], usage?: string[], featureRequest?: string } */
  answersJson: string
  submittedAt: string
}
