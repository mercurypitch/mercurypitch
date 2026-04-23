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

/** Audio engine callbacks */
export interface AudioEngineCallbacks {
  onNoteChange?: (note: MelodyNote, noteIndex: number) => void
  onPlaybackEnd?: () => void
}

/** Pitch detection result */
export interface PitchResult {
  /** Detected frequency in Hz */
  frequency: number
  /** Clarity/confidence score (0-1) */
  clarity: number
  /** Detected note name */
  noteName: string
  /** Detected octave */
  octave: number
  /** Cents deviation from the nearest note (-50 to +50) */
  cents: number
}

/** A single pitch sample collected during note playback */
export interface PitchSample {
  /** Detected frequency in Hz */
  freq: number
  /** Timestamp (ms since playback start) */
  time: number
  /** Cents deviation */
  cents: number
}

/** Result of singing a single note */
export interface NoteResult {
  /** The target melody note */
  targetNote: MelodyNote
  /** All pitch samples collected */
  samples: PitchSample[]
  /** Average detected frequency */
  avgFreq: number
  /** Average cents deviation */
  avgCents: number
  /** Number of samples captured */
  sampleCount: number
  /** Assigned accuracy rating */
  rating: AccuracyRating
  /** Cumulative pitch error (sum of |cents|) */
  totalError: number
}

/** Practice session result (one full cycle) */
export interface PracticeResult {
  /** Results for each note in the melody */
  noteResults: NoteResult[]
  /** Overall score (0-100) */
  score: number
  /** Average cents deviation */
  avgCents: number
  /** Number of notes practiced */
  noteCount: number
}

/** Preset melody definition */
export interface Preset {
  /** Preset display name */
  name: string
  /** Melody items */
  melody: MelodyItem[]
  /** Musical key */
  key: string
  /** Tempo in BPM */
  bpm: number
  /** Number of total beats */
  totalBeats: number
  /** Scale definition for this preset */
  scale: ScaleDefinition[]
}

/** Accuracy band definition */
export interface AccuracyBand {
  /** Cents threshold for this band */
  threshold: number
  /** Score band (100=perfect, 90=excellent, 75=good, 50=okay, 0=off) */
  band: number
  /** Display color */
  color: string
}

/** Piano roll configuration */
export interface PianoRollConfig {
  /** Row height in pixels */
  rowHeight: number
  /** Beat width in pixels */
  beatWidth: number
  /** Piano key column width in pixels */
  pianoWidth: number
  /** Ruler height in pixels */
  rulerHeight: number
  /** Beats per bar (for bar line rendering) */
  beatsPerBar: number
  /** Minimum note duration in beats */
  minDuration: number
  /** Note colors for different states */
  noteColors: {
    normal: string
    selected: string
    active: string
    ghost: string
  }
}

import type { AudioEngine } from '../lib/audio-engine'
import type { PianoRollEditor } from '../lib/piano-roll'

/** Window extensions for global references */
export interface PitchPerfectWindow extends Window {
  pianoRollEditor?: PianoRollEditor
  pianoRollAudioEngine?: AudioEngine
  pianoRollGenerateId?: () => number
}

// ── Practice Sessions ─────────────────────────────────────────

export type SessionItemType = 'preset' | 'scale' | 'rest'

/** A single item within a practice session */
export interface SessionItem {
  /** Item type */
  type: SessionItemType
  /** Preset ID (for type='preset') */
  presetId?: string
  /** Scale type (for type='scale') */
  scaleType?: string
  /** Custom display label */
  label?: string
  /** Duration in beats (for type='scale') */
  beats?: number
  /** Duration in ms (for type='rest') */
  restMs?: number
  /** Number of times to repeat this item (default 1) */
  repeat?: number
}

/** Difficulty level for practice sessions */
export type SessionDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** Category for practice sessions */
export type SessionCategory = 'vocal' | 'instrumental' | 'ear-training' | 'general'

/** A structured practice session with multiple items */
export interface PracticeSession {
  /** Unique session ID */
  id: string
  /** Display name */
  name: string
  /** Description */
  description: string
  /** Difficulty level */
  difficulty: SessionDifficulty
  /** Category */
  category: SessionCategory
  /** Session items */
  items: SessionItem[]
}

// ============================================================
// Melody Library Types
// ============================================================

/** Data for a single user-created melody */
export interface MelodyData {
  /** Unique melody ID */
  id: string
  /** Display name */
  name: string
  /** Creator name */
  author?: string
  /** Tempo for this melody (BPM) */
  bpm: number
  /** Musical key */
  key: string
  /** Scale type */
  scaleType: string
  /** Default octave */
  octave?: number
  /** Melody notes */
  items: MelodyItem[]
  /** Tags for categorization */
  tags?: string[]
  /** User notes about this melody */
  notes?: string
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
  /** Play count for popularity tracking */
  playCount?: number
}

/** Main melody library structure */
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
    custom?: Record<string, unknown>
  }
  /** All saved melodies */
  melodies: Record<string, MelodyData>
  /** User-created playlists */
  playlists: Record<string, {
    name: string
    melodyKeys: string[]
    created: number
  }>
}

/** Create session item from a melody */
export interface MelodySessionItem extends Omit<SessionItem, 'type'> {
  type: 'melody'
  melodyKey: string
}

