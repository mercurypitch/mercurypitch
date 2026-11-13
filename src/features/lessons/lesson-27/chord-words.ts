// ============================================================
// Lesson 27 chord words — each figure in words, for the ring's name, its live line and its readout
// ============================================================
//
// The ring is a picture whose accessible name and live line use words
// only (WEB-SPEC, Toys 1): "V, G major: G, B and D", "V7: G, B, D and F",
// "I with its seventh: C, E, G and B. Root to seventh: 11 semitones",
// "C major, first inversion, E in the bass: E, G and C", every sharp said
// as a word. The readout under the ring prints what the step adds: the
// root's distance to the seventh in Step 1, the position's name in Step 4
// and free play (FACTS 42, 50).

import { POSITION_NAMES } from '@/features/lessons/kit/inversions'
import type { Spelled } from '@/features/lessons/kit/notes'
import { wordName } from '@/features/lessons/kit/notes'
import { andList } from '@/features/lessons/kit/rhythm-words'
import type { Chord, ChordId } from './sounds'
import { rootToSeventh } from './sounds'

/** Notes in words, with no octave: "G, B, D and F sharp". */
export const lettersSaid = (notes: readonly Spelled[]): string =>
  andList(notes.map((n) => wordName(n, { octave: false })))

/** Each chord's name before its notes (FACTS 15, 16, 28). */
const NAMES: Readonly<
  Record<ChordId, { readonly root: string; readonly turned: string }>
> = {
  I: { root: 'I, C major', turned: 'C major' },
  I7: { root: 'I with its seventh', turned: 'I with its seventh' },
  V: { root: 'V, G major', turned: 'G major' },
  V7: { root: 'V7', turned: 'V7' },
  iii: { root: 'iii, E minor', turned: 'E minor' },
  'V+F': { root: 'V with F', turned: 'V with F' },
  'V+F#': { root: 'V with F sharp', turned: 'V with F sharp' },
}

/** "Root to seventh: 11 semitones", for a chord with its seventh. */
export function seventhReadout(c: Chord): string {
  const n = rootToSeventh(c)
  return n === null ? '' : `Root to seventh: ${n} semitones`
}

/** A position's name, as the readout prints it: "First inversion". */
export const positionName = (position: number): string =>
  POSITION_NAMES[position] ?? POSITION_NAMES[0]

/**
 * A figure in words: the chord's name and its notes, low to high, with
 * where it stands when the bass is marked, and the root's distance to its
 * seventh when the readout gives it.
 */
export function figureSaid(
  c: Chord,
  notes: readonly Spelled[],
  o: { readonly position?: number | null; readonly seventh?: boolean } = {},
): string {
  const letters = lettersSaid(notes)
  if (o.position !== undefined && o.position !== null) {
    // the notes run low to high, so the first is the bass
    const where = positionName(o.position).toLowerCase()
    return `${NAMES[c.id].turned}, ${where}, ${wordName(notes[0], { octave: false })} in the bass: ${letters}`
  }
  const base = `${NAMES[c.id].root}: ${letters}`
  const readout = o.seventh === true ? seventhReadout(c) : ''
  return readout === '' ? base : `${base}. ${readout}`
}
