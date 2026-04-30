// ============================================================
// Scale Data — Music theory utilities for PitchPerfect
// ============================================================

import type { MelodyItem, MelodyNote, NoteName, ScaleDefinition, ScaleDegree, } from '@/types'

export const NOTE_NAMES: NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

// White-key names (for display)
export const WHITE_NOTE_NAMES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// Major scale intervals (semitones from root)
export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12]

// Key name → number of sharps (positive) or flats (negative)
export const KEY_SIGNATURES: Record<string, { sharps: number; flats: number }> =
  {
    C: { sharps: 0, flats: 0 },
    G: { sharps: 1, flats: 0 },
    D: { sharps: 2, flats: 0 },
    A: { sharps: 3, flats: 0 },
    E: { sharps: 4, flats: 0 },
    B: { sharps: 5, flats: 0 },
    'F#': { sharps: 6, flats: 0 },
    F: { sharps: 0, flats: 1 },
    Bb: { sharps: 0, flats: 2 },
    Eb: { sharps: 0, flats: 3 },
    Ab: { sharps: 0, flats: 4 },
    Db: { sharps: 0, flats: 5 },
    Gb: { sharps: 0, flats: 6 },
  }

// Key → root note index (0=C, 1=C#, etc.)
export const KEY_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  'B#': 0,
}

/** Get the frequency of the tonic (root note) for a given key at a given octave. */
export function keyTonicFreq(keyName: string, octave: number): number {
  const offset = KEY_OFFSETS[keyName] ?? 0
  const midi = (octave + 1) * 12 + offset
  return midiToFreq(midi)
}

// Scale definitions
export const SCALE_DEFINITIONS: Record<string, ScaleDefinition> = {
  major: {
    name: 'major',
    degrees: [0, 2, 4, 5, 7, 9, 11, 12],
    description: 'Bright and happy — the most common scale',
  },
  'natural-minor': {
    name: 'natural-minor',
    degrees: [0, 2, 3, 5, 7, 8, 10, 12],
    description: 'Sad and introspective',
  },
  'harmonic-minor': {
    name: 'harmonic-minor',
    degrees: [0, 2, 3, 5, 7, 8, 11, 12],
    description: 'Minor with raised 7th — exotic tension',
  },
  'melodic-minor': {
    name: 'melodic-minor',
    degrees: [0, 2, 3, 5, 7, 9, 11, 12],
    description: 'Jazz minor — raised 6th and 7th ascending',
  },
  phrygian: {
    name: 'phrygian',
    degrees: [0, 1, 3, 5, 7, 8, 10, 12],
    description: 'Dark, flamenco-style — flat 2nd',
  },
  lydian: {
    name: 'lydian',
    degrees: [0, 2, 4, 6, 7, 9, 11, 12],
    description: 'Dreamy, floating — raised 4th',
  },
  locrian: {
    name: 'locrian',
    degrees: [0, 1, 3, 5, 6, 8, 10, 12],
    description: 'Diminished, unstable — half-diminished',
  },
  'pentatonic-major': {
    name: 'pentatonic-major',
    degrees: [0, 2, 4, 7, 9, 12],
    description: 'Folk and rock, no half steps',
  },
  'pentatonic-minor': {
    name: 'pentatonic-minor',
    degrees: [0, 3, 5, 7, 10, 12],
    description: 'Blues and rock, expressive',
  },
  blues: {
    name: 'blues',
    degrees: [0, 3, 5, 6, 7, 10, 12],
    description: 'Blues scale with the "blue note"',
  },
  chromatic: {
    name: 'chromatic',
    degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    description: 'All 12 semitones',
  },
  dorian: {
    name: 'dorian',
    degrees: [0, 2, 3, 5, 7, 9, 10, 12],
    description: 'Minor with a raised 6th — jazzy',
  },
  mixolydian: {
    name: 'mixolydian',
    degrees: [0, 2, 4, 5, 7, 9, 10, 12],
    description: 'Major with a flat 7th — rock and roll',
  },
}

// ============================================================
// MIDI / Frequency conversion
// ============================================================

const A4_MIDI = 69
const A4_FREQ = 440.0

/** Convert MIDI note number to frequency in Hz */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** Convert frequency in Hz to nearest MIDI note number */
export function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / A4_FREQ) + A4_MIDI)
}

/** Convert note name + octave to MIDI number */
export function noteToMidi(name: NoteName | string, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(name as NoteName)
  if (noteIndex === -1) return 60 // fallback to C4
  return (octave + 1) * 12 + noteIndex
}

/** Convert MIDI number to note name and octave */
export function midiToNote(midi: number): { name: NoteName; octave: number } {
  const noteIndex = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return { name: NOTE_NAMES[noteIndex], octave }
}

/** Convert frequency to nearest note info */
export function freqToNote(
  freq: number,
): MelodyNote & { cents: number; midi: number } {
  const midi = freqToMidi(freq)
  const exactMidi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
  const cents = Math.round((exactMidi - midi) * 100)
  const { name, octave } = midiToNote(midi)
  return { name, octave, freq, midi, cents }
}

// ============================================================
// Scale building
// ============================================================

/** Build an 8-note major scale starting at the given octave */
export function buildMajorScale(
  keyName: string,
  octave: number,
): ScaleDegree[] {
  const rootOffset = KEY_OFFSETS[keyName] ?? 0
  const scale: ScaleDegree[] = []

  for (let i = 0; i < MAJOR_SCALE_INTERVALS.length; i++) {
    const semitone = MAJOR_SCALE_INTERVALS[i]
    const midi = (octave + 1) * 12 + rootOffset + semitone
    const { name, octave: oct } = midiToNote(midi)
    scale.push({
      midi,
      name: name,
      octave: oct,
      freq: midiToFreq(midi),
      semitone,
    })
  }

  return scale
}

/**
 * Parse a custom scale type string like "custom:name:C,C#,D,..."
 * Returns an array of semitone degrees (0-11) relative to the root.
 */
function parseCustomScaleDegrees(scaleType: string): number[] | null {
  if (!scaleType.startsWith('custom:')) return null
  const parts = scaleType.split(':')
  if (parts.length < 3) return null
  const noteList = parts[2]
  if (!noteList) return null
  const noteNames = noteList.split(',')
  const degrees: number[] = []
  for (const noteName of noteNames) {
    const noteIndex = NOTE_NAMES.indexOf(noteName.trim() as NoteName)
    if (noteIndex === -1) continue
    degrees.push(noteIndex)
  }
  // Sort ascending and deduplicate
  degrees.sort((a, b) => a - b)
  const unique: number[] = []
  for (const d of degrees) {
    if (unique.length === 0 || unique[unique.length - 1] !== d) {
      unique.push(d)
    }
  }
  return unique.length >= 2 ? unique : null
}

/** Build a multi-octave scale (high to low for piano roll display) */
export function buildMultiOctaveScale(
  keyName: string,
  startOctave: number,
  numOctaves: number,
  scaleType: string = 'major',
): ScaleDegree[] {
  const rootOffset = KEY_OFFSETS[keyName] ?? 0

  // Handle custom scales
  const customDegrees = parseCustomScaleDegrees(scaleType)
  const intervals =
    customDegrees ??
    SCALE_DEFINITIONS[scaleType]?.degrees ??
    MAJOR_SCALE_INTERVALS

  const scale: ScaleDegree[] = []

  // Most scale definitions include both the root (0) and the closing
  // octave (12). When we stack multiple octaves, the top of octave N
  // (semitone 12) and the root of octave N+1 (semitone 0) refer to the
  // same MIDI note, which produced duplicate rows like two C4s sitting
  // adjacent in the piano-roll grid. Detect this case and skip the
  // closing-octave degree on every iteration except the topmost so each
  // pitch appears exactly once.
  const isTopmost = (oct: number): boolean =>
    oct === startOctave + numOctaves - 1
  const intervalsHasOctave = intervals[intervals.length - 1] === 12
  const intervalsHasRoot = intervals[0] === 0

  for (let oct = startOctave + numOctaves - 1; oct >= startOctave; oct--) {
    for (let i = intervals.length - 1; i >= 0; i--) {
      const semitone = intervals[i]
      // Drop semitone 12 (closing octave) for every iteration below the
      // top one — its MIDI value collides with the root of the next
      // octave up, producing a duplicate row.
      if (
        intervalsHasOctave &&
        intervalsHasRoot &&
        semitone === 12 &&
        !isTopmost(oct)
      ) {
        continue
      }
      const midi = (oct + 1) * 12 + rootOffset + semitone
      const { name, octave: octOut } = midiToNote(midi)
      scale.push({
        midi,
        name: name,
        octave: octOut,
        freq: midiToFreq(midi),
        semitone,
      })
    }
  }

  return scale
}

/** Build a sample melody in the given key */
export function buildSampleMelody(
  keyName: string,
  octave: number,
): MelodyItem[] {
  const scale = buildMajorScale(keyName, octave)
  return [
    { note: scale[0] as MelodyNote, startBeat: 0, duration: 2 },
    { note: scale[2] as MelodyNote, startBeat: 2, duration: 2 },
    { note: scale[4] as MelodyNote, startBeat: 4, duration: 2 },
    { note: scale[6] as MelodyNote, startBeat: 6, duration: 4 },
    { note: scale[4] as MelodyNote, startBeat: 10, duration: 2 },
    { note: scale[3] as MelodyNote, startBeat: 12, duration: 2 },
    { note: scale[2] as MelodyNote, startBeat: 14, duration: 2 },
    { note: scale[0] as MelodyNote, startBeat: 16, duration: 4 },
  ]
}

// ============================================================
// Melody utilities
// ============================================================

/** Total duration of a melody in beats */
export function melodyTotalBeats(melody: MelodyItem[]): number {
  if (melody.length === 0) return 0
  let max = 0
  for (const item of melody) {
    const end = item.startBeat + item.duration
    if (end > max) max = end
  }
  return max
}

/** Get the melody item at a given beat position */
export function melodyNoteAtBeat(
  melody: MelodyItem[],
  beat: number,
): MelodyItem | null {
  for (const item of melody) {
    if (beat >= item.startBeat && beat < item.startBeat + item.duration) {
      return item
    }
  }
  return null
}

/** Get the melody item index at a given beat position */
export function melodyIndexAtBeat(melody: MelodyItem[], beat: number): number {
  for (let i = 0; i < melody.length; i++) {
    const item = melody[i]
    if (item.isRest === true) continue
    if (beat >= item.startBeat && beat < item.startBeat + item.duration) {
      return i
    }
  }
  return -1
}

/** Check if a note name is a black key */
export function isBlackKey(name: string): boolean {
  return name.includes('#')
}

/** Get MIDI range (lowest to highest) from a melody */
export function melodyMidiRange(melody: MelodyItem[]): {
  min: number
  max: number
} {
  if (melody.length === 0) return { min: 60, max: 72 }
  let min = melody[0].note.midi
  let max = melody[0].note.midi
  for (const item of melody) {
    if (item.note.midi < min) min = item.note.midi
    if (item.note.midi > max) max = item.note.midi
  }
  return { min, max }
}
