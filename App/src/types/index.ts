// ============================================================
// Shared Types for PitchPerfect
// These are used across multiple modules
// ============================================================

/** Note name within an octave (C through B, with # for sharps) */
export type NoteName =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B'

/** Pitch accuracy rating for feedback */
export type AccuracyRating = 'perfect' | 'excellent' | 'good' | 'okay' | 'off'

/** Playback mode for the melody engine */
export type PlaybackMode = 'once' | 'repeat' | 'practice'

/** Extra rest spacing used by the Practice tab's "Spaced" mode. */
export type SpacedRestMode = 'none' | 'fourth' | 'half' | 'full'

/** Transport playback state */
export type TransportState = 'stopped' | 'playing' | 'paused' | 'precount'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/** Accuracy band with threshold */
export interface AccuracyBand {
  band: 0 | 50 | 75 | 90 | 100
  threshold: number
  color: string
}

export type AccuracyBandValue = 0 | 50 | 75 | 90 | 100

/** A single note within the melody */
export interface MelodyNote {
  /** MIDI note number (e.g., 60 = C4) */
  midi: number
  /** Note name without octave (C, C#, D, etc.) */
  name: NoteName
  /** Octave number (e.g., 4 for middle C) */
  octave: number
  /** Frequency in Hz (e.g., 261.63 for C4) */
  freq: number
}

/** Effect type for note modifications */
export type EffectType =
  | 'slide-up'
  | 'slide-down'
  | 'ease-in'
  | 'ease-out'
  | 'vibrato'

/** A melody item used by the audio engine and piano roll */
export interface MelodyItem {
  /** Unique identifier for the note block */
  id?: number
  /** Note data (name, octave, MIDI, frequency) */
  note: MelodyNote
  /** Duration in beats */
  duration: number
  /** Start position in beats (from 0) */
  startBeat: number
  /** Velocity (0-127, default 100) */
  velocity?: number
  /** Effect type applied to this note */
  effectType?: EffectType
  /** IDs of linked notes (for slides/ease: next note; for vibrato: start note) */
  linkedTo?: number[]
  /** Visual/playback rest inserted for practice spacing. Not persisted as a real melody note. */
  isRest?: boolean
}

/** Scale degree definition */
export interface ScaleDegree {
  /** MIDI note number */
  midi: number
  /** Note name (C, C#, D, etc.) */
  name: string
  /** Octave number */
  octave: number
  /** Frequency in Hz */
  freq: number
  /** Semitone offset from root note */
  semitone: number
}

/** Scale definition */
export interface ScaleDefinition {
  /** Scale name (e.g., 'major', 'minor', 'pentatonic') */
  name: string
  /** Array of semitone offsets from the root */
  degrees: number[]
  /** Description text */
  description: string
}

/** Key signature definition */
export interface KeySignature {
  /** Number of sharps (positive) or flats (negative) */
  sharps: number
  /** Number of flats */
  flats: number
  /** Display name (e.g., 'C major', 'G major') */
  displayName: string
}

/** Progress bar value for practice engine */
export type ProgressBarValue =
  | 'ready'
  | 'playing'
  | 'paused'
  | 'precount'
  | 'complete'

/** Note result from practice engine */
export interface NoteResult {
  /** Original melody item */
  item: MelodyItem
  /** Pitch in Hz when note started */
  pitchFreq: number
  /** Identified pitch in cents from target */
  pitchCents: number
  /** Time spent on this note (ms) */
  time: number
  /** Rating for this note */
  rating: AccuracyRating
  /** Average cents deviation from target */
  avgCents: number
  /** Target note name */
  targetNote: string
}

/** Practice session result summary (for score overlay) */
export interface PracticeResult {
  /** Overall score (0-100) */
  score: number
  /** Number of notes completed */
  noteCount: number
  /** Average cents deviation */
  avgCents: number
  /** Number of completed items */
  itemsCompleted: number
  /** Total items in session */
  totalItems?: number
  /** Session name */
  name: string
  /** Practice mode */
  mode: PlaybackMode
  /** Completed at timestamp */
  completedAt: number

  // FIXME: Refactor accuracy heatmap somehow differently, from sessions, but this way we need to
  // keep the midi notes info! Though we only need noteResult.item.note.midi values
  noteResult: NoteResult[]
}

/** Active tab for the application */
export type ActiveTab = 'practice' | 'editor' | 'settings' | 'vocal-analysis' | 'community' | 'leaderboard' | 'vocal-challenges'
/** Practice sub-mode options */
export type PracticeSubMode = 'all' | 'random' | 'focus' | 'reverse'

/** Pitch result from practice engine */
export interface PitchResult {
  /** Pitch in Hz */
  freq: number
  /** MIDI note number (estimated) */
  midi: number
  /** Note name (e.g., 'C4') */
  note: string
  noteName: string
  /** Target note MIDI */
  targetMidi: number
  /** Target note name (e.g., 'C4') */
  targetNote: string
  /** Difference in cents from target */
  cents: number
  /** Frequency value (clarity) */
  frequency: number
  /** Clarity/clarity value */
  clarity: number
  /** Octave */
  octave: number
}

/** Static template for practice sessions (used in presets/sessions data) */
export interface SessionTemplate {
  id: string
  name: string
  difficulty: SessionDifficulty
  category: SessionCategory
  items: SessionItem[]
  description?: string
}

/** Session result for history */
export interface SessionResult {
  sessionId?: string
  name: string
  score: number
  totalItems?: number
  practiceItemResult: PracticeResult[]
  itemsCompleted: number
  sessionName: string
  completedAt: number
  avgCents?: number
  rating?: AccuracyRating
}

/** PitchPerfectWindow extension */
export interface PitchPerfectWindow extends Window {
  pitchperfect: {
    toggleTheme: () => void
    toggleMicWaveVisible?: () => void
  }
}

/** History entry for tracking user actions */
export interface HistoryEntry {
  /** Time of action */
  timestamp: number
  /** Action type */
  type:
    | 'preset_load'
    | 'preset_save'
    | 'preset_delete'
    | 'tab_change'
    | 'note_add'
    | 'note_delete'
    | 'note_edit'
  /** Action details */
  details: Record<string, unknown>
}

/** Preset data for saving/loading melodies */
export interface PresetData {
  /** Array of preset notes */
  notes: Array<{
    midi: number
    startBeat: number
    duration: number
    effectType?: EffectType
    linkedTo?: number[]
  }>
  /** Total beats in melody */
  totalBeats: number
  /** Beats per minute */
  bpm: number
  /** Scale data */
  scale: ScaleDegree[]
}

/** A single melody saved in the library */
export interface MelodyData {
  /** Unique melody ID */
  id: string
  /** Display name */
  name: string
  /** Creator name */
  author?: string
  /** Tempo in beats per minute */
  bpm: number
  /** Musical key (e.g., 'C', 'G') */
  key: string
  /** Scale type (e.g., 'major', 'minor', 'pentatonic') */
  scaleType: string
  /** Last played timestamp */
  lastPlayed?: number
  /** Default octave */
  octave?: number
  /** Array of melody items (notes) */
  items: MelodyItem[]
  /** Tags for categorization */
  tags?: string[]
  /** User notes */
  notes?: string
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
  /** Number of times played */
  playCount?: number
}

/** Melody library storage structure (legacy) */
export interface MelodyLibrary {
  /** Library metadata */
  meta: {
    author: string
    version: string
    lastUpdated: number
  }
  /** Render settings */
  renderSettings: {
    gridlines: boolean
    showLabels: boolean
    showNumbers: boolean
    [key: string]: unknown
  }
  /** Saved melodies */
  melodies: Record<string, MelodyData>
  /** User-created playlists */
  playlists: Record<
    string,
    {
      name: string
      melodyKeys: string[]
      sessionKeys: string[]
      created: number
    }
  >
  /** User sessions */
  sessions: Record<string, PlaybackSession>
}

/** Unified library storage structure - single storage key for all content */
export interface UnifiedLibrary {
  /** Library metadata */
  meta: {
    author: string
    version: string
    lastUpdated: number
  }
  /** Render settings */
  renderSettings: {
    gridlines: boolean
    showLabels: boolean
    showNumbers: boolean
    [key: string]: unknown
  }
  /** Saved melodies */
  melodies: Record<string, MelodyData>
  /** User-created playlists */
  playlists: Record<
    string,
    {
      name: string
      melodyKeys: string[]
      sessionKeys: string[]
      created: number
    }
  >
  /** User sessions */
  sessions: Record<string, PlaybackSession>
}

/** Session item type */
/**
 * Session item type. v3 narrowed this from `'preset' | 'scale' | 'rest' |
 * 'melody'` to just `'melody' | 'rest'`. PlaybackSessions now exclusively
 * hold melody references and rests — scales are pre-seeded as melodies
 * (e.g. `scale-major-c4`) and referenced by melodyId, and presets were
 * historically just embedded melodies which are now first-class library
 * entries. This keeps every clickable sidebar pill consistent.
 */
export type SessionItemType = 'melody' | 'rest'

/** A rest item with specific position in timeline */
export interface SessionRest {
  id: string
  startBeat: number // Position in timeline (beats from start)
  duration: number // Duration in beats
  label: string // Display name (e.g., "Rest")
}

/** Rest item for session items (legacy - embedded rest with ms duration) */
export type SessionRestItem = 'rest'

/** Session difficulty levels */
export type SessionDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'

/** Session categories */
export type SessionCategory =
  | 'warmup'
  | 'scales'
  | 'melodic'
  | 'rhythmic'
  | 'ear_training'
  | 'custom'
  | 'vocal'

/** A session item in user sessions */
export interface SessionItem {
  /** Unique identifier for this item (used for Map key) */
  id: string
  /** Item type */
  type: SessionItemType
  /** Start position in beats */
  startBeat: number
  /** Item label/name */
  label: string
  /** Scale type (for scale items) */
  scaleType?: string
  /** Number of beats (for scale items) */
  beats?: number
  /** Melody ID reference (for preset items) */
  melodyId?: string
  /** Array of melody items (embedded for preset items) */
  items?: MelodyItem[]
  /** Rest duration in ms (for rest items) */
  restMs?: number
  /** Item-specific settings */
  settings?: Record<string, unknown>
  /** Repeat count (for session item) */
  repeat?: number
}

/** Sequence of Melody items define a session */
export interface PlaybackSession {
  /** Unique session ID */
  id: string
  /** Session name */
  name: string
  /** Creator name */
  author?: string
  /** Can this session be deleted by user? (false for Default/Internal sessions) */
  deletable: boolean
  /** Array of session items */
  items: SessionItem[]
  /** Creation timestamp */
  created: number
  /** Last played timestamp */
  lastPlayed?: number
  /** Difficulty level */
  difficulty?: SessionDifficulty
  /** Session category */
  category?: SessionCategory
  /** Description */
  description?: string
}

/** Pitch sample for pitch history tracking */
export interface PitchSample {
  /** Pitch frequency in Hz */
  freq: number | null
  /** Cents deviation from target (undefined = no pitch detected) */
  cents?: number
  /** Sample timestamp (beat position or performance.now() delta) */
  time: number
}

/** Piano roll editor configuration */
export interface PianoRollConfig {
  rowHeight: number
  beatWidth: number
  pianoWidth: number
  rulerHeight: number
  beatsPerBar: number
  minDuration: number
  noteColors: {
    normal: string
    selected: string
    active: string
    ghost: string
  }
}

/** Session history entry */
export interface SessionHistoryEntry {
  /** Session ID */
  sessionId?: string
  /** Session name */
  name: string
  /** Score achieved */
  score: number
  /** Total items in session */
  totalItems?: number
  /** Items completed */
  itemsCompleted: number
  /** Average cents deviation */
  avgCents?: number
  /** Accuracy rating */
  rating?: AccuracyRating
  /** Timestamp */
  completedAt: number
}

/** Walkthrough tab type */
export type WalkthroughTab = 'practice' | 'editor' | 'settings'

/** Walkthrough step definition */
export interface WalkthroughStep {
  /** Step title */
  title: string
  /** Step description */
  description: string
  /** Action to perform */
  action: string
  /** CSS selector for target element (optional) */
  target?: string
}

/** Walkthrough content definition */
export interface WalkthroughContent {
  /** Unique identifier */
  id: string
  /** Target tab */
  tab: WalkthroughTab
  /** Display title */
  title: string
  /** Short description */
  description: string
  /** Detailed content text */
  content: string
  /** Step-by-step instructions */
  steps: WalkthroughStep[]
  /** Visual icon/thumbnail */
  thumbnail: string
}

/** Walkthrough progress tracking */
export interface WalkthroughProgress {
  /** Walkthrough ID -> timestamp when viewed/completed */
  [id: string]: number
}

// ============================================================
// Community Leaderboard Types
// ============================================================

/** Leaderboard view mode */
export type LeaderboardView = 'global' | 'friends' | 'weekly'

/** User ranking in leaderboard */
export interface LeaderboardUser {
  /** User ID */
  userId: string
  /** Display name */
  displayName: string
  /** Avatar emoji */
  avatar?: string
  /** Current score/rank points */
  score: number
  /** Rank position */
  rank: number
  /** Streak count */
  streak: number
  /** Total sessions completed */
  totalSessions: number
  /** Best score percentage */
  bestScore: number
  /** Current accuracy percentage */
  accuracy: number
  /** Join date */
  joinDate: number
}

/** Leaderboard category */
export type LeaderboardCategory = 'overall' | 'best-score' | 'accuracy' | 'streak' | 'sessions'

/** Weekly challenge result */
export interface WeeklyChallengeResult {
  /** Challenge ID */
  challengeId: string
  /** Challenge name */
  name: string
  /** Challenge description */
  description: string
  /** Icon */
  icon: string
  /** Current user's rank */
  userRank: number
  /** Global rank */
  globalRank: number
  /** Challenge date range */
  startDate: number
  /** Challenge type */
  type: 'high-notes' | 'low-notes' | 'speed' | 'perfect' | 'scales'
  /** Target score */
  targetScore: number
  /** User's score on this challenge */
  userScore: number
}
