// Shared chord tone utilities — used by fretboard canvas, selectors, and quiz panels

import { MAX_FRET, OPEN_MIDI } from './constants'

/** Semitone intervals from root for each chord type */
export const CHORD_TYPES: Record<string, { label: string; degrees: number[] }> =
  {
    maj: { label: 'Major', degrees: [0, 4, 7] },
    min: { label: 'Minor', degrees: [0, 3, 7] },
    dim: { label: 'Diminished', degrees: [0, 3, 6] },
    aug: { label: 'Augmented', degrees: [0, 4, 8] },
    maj7: { label: 'Maj7', degrees: [0, 4, 7, 11] },
    min7: { label: 'Min7', degrees: [0, 3, 7, 10] },
    dom7: { label: 'Dom7', degrees: [0, 4, 7, 10] },
    m7b5: { label: 'Half-Dim', degrees: [0, 3, 6, 10] },
    dim7: { label: 'Dim7', degrees: [0, 3, 6, 9] },
    sus4: { label: 'Sus4', degrees: [0, 5, 7] },
    sus2: { label: 'Sus2', degrees: [0, 2, 7] },
  }

/**
 * Returns the chord tone role of a MIDI note relative to a root, or null if not a chord tone.
 */
export function getChordToneRole(
  midi: number,
  rootMidi: number,
  chordName: string,
): 'root' | 'second' | 'third' | 'fourth' | 'fifth' | 'seventh' | null {
  const chord = CHORD_TYPES[chordName]
  if (chord === undefined) return null
  const degree = (((midi - rootMidi) % 12) + 12) % 12
  const idx = chord.degrees.indexOf(degree)
  if (idx === -1) return null
  if (idx === 0) return 'root'
  if (idx === 1) {
    // Role is interval-based, not purely positional: sus chords replace
    // the third with a 2nd (sus2) or 4th (sus4) at this same array index.
    if (degree === 2) return 'second'
    if (degree === 5) return 'fourth'
    return 'third'
  }
  if (idx === 2) return 'fifth'
  if (idx === 3) return 'seventh'
  return null
}

/** True if the MIDI note's pitch class is a chord tone of the given chord. */
export function isChordTone(
  midi: number,
  rootMidi: number,
  chordName: string,
): boolean {
  return getChordToneRole(midi, rootMidi, chordName) !== null
}

/**
 * Build the set of all MIDI values across 6 strings × 16 frets that are chord tones
 * for the given chord rooted at the given MIDI note.
 */
export function buildChordToneMidis(
  rootMidi: number,
  chordName: string,
): Set<number> {
  const chord = CHORD_TYPES[chordName]

  const set = new Set<number>()
  if (chord === undefined) return set
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= MAX_FRET; f++) {
      const midi = OPEN_MIDI[s] + f
      if (isChordTone(midi, rootMidi, chordName)) set.add(midi)
    }
  return set
}
