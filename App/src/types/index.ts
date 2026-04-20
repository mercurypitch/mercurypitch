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

/** Transport playback state */
export type TransportState = 'stopped' | 'playing' | 'paused' | 'precount'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/** Accuracy band with threshold */
export type AccuracyBand = 0 | 50 | 75 | 90 | 100

export interface AccuracyBandDef {
  band: AccuracyBand
  threshold: number
}

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
export type ProgressBarValue = 'ready' | 'playing' | 'paused' | 'precount' | 'complete'

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

/** Practice session record */
export interface PracticeSession {
  /** Unique session ID */
  id: string
  /** Session name */
  name: string
  /** Practice mode (once/repeat/practice) */
  mode: PlaybackMode
  /** Number of cycles */
  cycles: number
  /** Scale definition */
  scale: ScaleDefinition
  /** Current cycle number */
  currentCycle: number
  /** Beats per measure */
  beatsPerMeasure: number
  /** Is recording */
  isRecording: boolean
  /** Recorded notes */
  items: MelodyItem[]
  /** Practice results per note */
  noteResults: NoteResult[]
  /** Average score across all notes */
  score: number
  /** Session duration in ms */
  duration: number
  /** Completed at timestamp */
  completedAt: number
  /** Items completed count */
  itemsCompleted: number
  /** Difficulty level */
  difficulty?: string
  /** Category */
  category?: string
  /** Description */
  description?: string
}

/** Session result for history */
export interface SessionResult {
  sessionId?: string
  name: string
  score: number
  totalItems?: number
  itemsCompleted: number
  sessionName: string
  completedAt: number
  avgCents?: number
  rating?: AccuracyRating
}

/** Practice result */
export type PracticeResult = NoteResult

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
  type: 'preset_load' | 'preset_save' | 'preset_delete' | 'tab_change' | 'note_add' | 'note_delete' | 'note_edit'
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
