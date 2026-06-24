// ============================================================
// Chord progression definitions and degree-to-chord mapping
// ============================================================

import { NOTE_NAMES } from '@/lib/note-utils'
import { KEY_OFFSETS } from '@/lib/scale-data'

export interface ProgressionDef {
  name: string
  degrees: number[]
}

export const PROGRESSIONS: ProgressionDef[] = [
  { name: 'I-IV-V', degrees: [1, 4, 5] },
  { name: 'I-V-vi-IV', degrees: [1, 5, 6, 4] },
  { name: 'ii-V-I', degrees: [2, 5, 1] },
  { name: 'I-vi-IV-V', degrees: [1, 6, 4, 5] },
  { name: 'I-vi-ii-V', degrees: [1, 6, 2, 5] },
  { name: 'I-IV-vi-V', degrees: [1, 4, 6, 5] },
  { name: 'vi-IV-I-V', degrees: [6, 4, 1, 5] },
  { name: 'I-iii-vi-IV', degrees: [1, 3, 6, 4] },
]

/** Diatonic chord types for each scale degree in a major key. */
const DIATONIC_CHORDS: Record<number, { quality: string; suffix: string }> = {
  1: { quality: 'maj', suffix: '' },
  2: { quality: 'min', suffix: 'm' },
  3: { quality: 'min', suffix: 'm' },
  4: { quality: 'maj', suffix: '' },
  5: { quality: 'maj', suffix: '' },
  6: { quality: 'min', suffix: 'm' },
  7: { quality: 'dim', suffix: 'dim' },
}

/** Semitone offsets from tonic for each scale degree in a major key. */
const DEGREE_SEMITONES: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
}

export interface DegreeChord {
  /** Full chord name like "C", "Dm", "Edim" */
  chordName: string
  /** The root MIDI note for this chord (C4 = 60-based) */
  rootMidi: number
  /** The chord quality key (for CHORD_TYPES) */
  quality: string
}

/**
 * Given a key and a scale degree (1-7), return the chord name and root MIDI.
 */
export function chordFromDegree(key: string, degree: number): DegreeChord {
  const diatonic = DIATONIC_CHORDS[((degree - 1) % 7) + 1]
  const keyOffset = KEY_OFFSETS[key] ?? 0
  const semitones = DEGREE_SEMITONES[((degree - 1) % 7) + 1]
  const chromaticOffset = (keyOffset + semitones) % 12

  const rootName = NOTE_NAMES[chromaticOffset]
  const chordName = rootName + diatonic.suffix
  const rootMidi = 60 + chromaticOffset

  return { chordName, rootMidi, quality: diatonic.quality }
}
