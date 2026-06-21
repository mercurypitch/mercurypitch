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
  results: PracticeResultRecord[]
}

// ── Challenges ──────────────────────────────────────────────────

export type ChallengeCategory =
  | 'high-notes'
  | 'low-notes'
  | 'speed'
  | 'perfect'
  | 'scales'

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

export interface Achievement extends DbEntity {
  name: string
  description: string
  icon: string
  points: number
  condition: string
  required: number
  sortOrder: number
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
  totalSessions: number
  bestScore: number
  accuracy: number
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
  status: string // 'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled'
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

export interface UvrStemBlob extends DbEntity {
  sessionId: string // matches UvrSession.sessionId from app-store
  stemType: 'vocal' | 'instrumental' | 'original'
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
}

export interface OfflinePitchAnalysisRecord extends DbEntity {
  fileHash: string
  analysisResultsJson: string
  lrcLinesJson: string
  segmentedNotesJson: string
}

export interface WhisperTranscriptionRecord extends DbEntity {
  sessionId: string
  /** JSON-serialized WhisperSegment[] */
  segmentsJson: string
  /** Number of segments for quick stats */
  segmentCount: number
}

// ── Onboarding Survey ─────────────────────────────────────────

export interface UserSurveyResponse extends DbEntity {
  userId: string
  /** JSON: { background?: string[], usage?: string[], featureRequest?: string } */
  answersJson: string
  submittedAt: string
}
