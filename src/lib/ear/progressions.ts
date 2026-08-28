// ============================================================
// progressions — Cadence's and Bassline's material.
//
// Cadence names a progression from the guitar room's eight; the
// bank seeds them from the plainest (I–IV–V) to the ones that share
// most of their chords with a neighbour. Bassline is root motion
// only: four roots over a held tonic, tapped back as degrees.
// Voicings are close, within the octave above the roved root, with
// the root doubled below in the bass — a hand at a guitar, not
// three leaps.
//
// Pure. Nothing here plays a sound.
// ============================================================

import { PROGRESSIONS } from '@/lib/guitar/chord-progression'
import type { EarBankItem } from './banks'

const DEGREE_SEMITONE = [0, 2, 4, 5, 7, 9, 11] as const
const DIATONIC_INTERVALS: Readonly<Record<number, readonly number[]>> = {
  1: [0, 4, 7],
  2: [0, 3, 7],
  3: [0, 3, 7],
  4: [0, 4, 7],
  5: [0, 4, 7],
  6: [0, 3, 7],
  7: [0, 3, 6],
}
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const

export function romanOf(degree: number): string {
  return ROMAN[Math.min(7, Math.max(1, Math.round(degree))) - 1]
}

/** "I–IV–V", the way the reveal says a progression. */
export function progressionName(degrees: readonly number[]): string {
  return degrees.map(romanOf).join('–')
}

/** The chord on a degree, voiced over `rootMidi` (the key's tonic):
 *  the chord root doubled an octave below, then a close triad. */
export function degreeChordMidis(rootMidi: number, degree: number): number[] {
  const index = Math.min(7, Math.max(1, Math.round(degree)))
  const chordRoot = rootMidi + DEGREE_SEMITONE[index - 1]
  const triad = DIATONIC_INTERVALS[index].map(
    (interval) => chordRoot + interval,
  )
  return [chordRoot - 12, ...triad]
}

/** The bass note of a degree, an octave under the roved tonic. */
export function bassRootMidi(rootMidi: number, degree: number): number {
  const index = Math.min(7, Math.max(1, Math.round(degree)))
  return rootMidi - 12 + DEGREE_SEMITONE[index - 1]
}

const CADENCE_SEEDS: Readonly<Record<string, number>> = {
  'I-IV-V': 900,
  'I-V-vi-IV': 1000,
  'ii-V-I': 1050,
  'I-vi-IV-V': 1100,
  'I-vi-ii-V': 1200,
  'I-IV-vi-V': 1250,
  'vi-IV-I-V': 1300,
  'I-iii-vi-IV': 1400,
}

export const CADENCE_BANK: readonly EarBankItem[] = PROGRESSIONS.map(
  (progression) => ({
    itemId: `cadence:${progression.name}`,
    label: progression.name.replace(/-/g, '–'),
    name: progressionName(progression.degrees),
    seed: CADENCE_SEEDS[progression.name] ?? 1200,
    payload: progression.degrees,
  }),
)

const MOTIONS: ReadonlyArray<[readonly number[], number]> = [
  [[1, 4, 5, 1], 900],
  [[1, 5, 4, 1], 950],
  [[1, 4, 1, 5], 1000],
  [[1, 6, 4, 5], 1050],
  [[1, 5, 6, 4], 1100],
  [[1, 2, 5, 1], 1150],
  [[1, 3, 4, 5], 1200],
  [[1, 6, 2, 5], 1250],
  [[1, 7, 6, 5], 1300],
  [[1, 4, 2, 5], 1350],
  [[1, 3, 6, 4], 1400],
  [[1, 5, 3, 6], 1450],
]

/** Four roots, the first always the tonic so the line has a floor. */
export const BASSLINE_BANK: readonly EarBankItem[] = MOTIONS.map(
  ([degrees, seed]) => ({
    itemId: `bassline:${degrees.join('')}`,
    label: degrees.join(' '),
    name: progressionName(degrees),
    seed,
    payload: [...degrees],
  }),
)
