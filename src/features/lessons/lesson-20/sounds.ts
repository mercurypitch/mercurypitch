// ============================================================
// Lesson 20 sounds — the staircase's scales and Merc's run, with every timing
// ============================================================
//
// What the steps play (FACTS 80; WEB-SPEC, Toys 1 and 5, and Audio). The
// staircase stands on C in the learner's octave, C3 for the lower voice or
// none stored and C4 for the higher (FACTS 8, 26), and plays as Lesson 4's
// does, 0.45 s a note with the last 0.9 s (kit/stairs-plays.ts): the
// major scale 4.05 s, the five 3.15 s, an inline play's two scales 0.5 s
// apart. The run is Merc's from D3, or Tavi's from D4: do, re, mi, so, la,
// so, mi, re and do, a note every 0.75, 0.6, 0.45, 0.3 or 0.2 s (Tempo's
// notches, FACTS 39), sung as one line in his "ooh", held on each note and
// gliding into the next over its last 50 ms (kit/sound.ts); Staccato's
// nine short notes, 0.15 s each, a note every 0.45 s, each its own voice on
// a short envelope that ends before the next note starts (FACTS 31); and
// Play it smudged's illustrated singer in the soft tone, each note gliding
// for 0.12 s of its 0.2 s and landing short (FACTS 82a).

import { hz } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { syllableOf } from '@/features/lessons/kit/stairs-scales'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** Do on the staircase: C3 for the lower voice or none stored, C4 for the higher (FACTS 8, 26). */
export const stairsDo = (v: Voice | null): number => (v === 'higher' ? 60 : 48)

/** Do of the run: Merc's D3, or Tavi's D4 for the higher voice (FACTS 8). */
export const runDo = (v: Voice | null): number => (v === 'higher' ? 62 : 50)

/** The quiet between the two halves of an inline play, s (FACTS 80). */
export const BETWEEN_SEC = 0.5

/** The run as degrees above do: do, re, mi, so, la, so, mi, re, do. */
export const RUN_DEGREES: readonly number[] = [0, 2, 4, 7, 9, 7, 4, 2, 0]

/** Each note's sung name, in order. */
export const RUN_NAMES: readonly string[] = RUN_DEGREES.map(syllableOf)

/** Tempo's five notches, s a note, slowest first (FACTS 39). */
export const TEMPOS: readonly number[] = [0.75, 0.6, 0.45, 0.3, 0.2]

/** Tempo's notch as Step 3 opens. */
export const FIRST_TEMPO = 0.6

/** The run toy's time axis, s across: the slowest run's length, so every tempo draws its beads at the same heights, closer together (FACTS 39). */
export const RUN_AXIS_SEC = 6.75

/** Step 4's run: a note every 0.45 s; Staccato's each 0.15 s on a short envelope (FACTS 31). */
export const TOUCH = {
  every: 0.45,
  staccato: 0.15,
  attack: 0.025,
  release: 0.08,
} as const

/** The glide into each new note of Merc's run, s. */
const GLIDE_SEC = 0.05

/** Play it smudged: a note every 0.2 s, each gliding for 0.12 s, and where each lands, cents from its note (FACTS 82a). */
export const SMUDGE = {
  every: 0.2,
  glide: 0.12,
  cents: [0, -20, -50, -45, -60, 45, 50, 25, 15],
} as const

/** Voice Mirror's band, cents either side of a note (kit/band-words.ts): a landing inside it is in the band. */
const BAND_CENTS = 35

/** Whether the smudged run's note `i` lands inside its band: four of the nine do. */
export const smudgeLands = (i: number): boolean =>
  Math.abs(SMUDGE.cents[i]) <= BAND_CENTS

/** The run's notes on `doMidi`, a note every `every` s, each `hold` s long (the slot unless staccato). */
export function runNotes(
  doMidi: number,
  every: number,
  hold = every,
): RunNote[] {
  return RUN_DEGREES.map((d, i) => ({
    t: Math.round(i * every * 1000) / 1000,
    midi: doMidi + d,
    dur: hold,
  }))
}

/** The run's length at a tempo: the last note's slot ends it. */
export const runSec = (every: number, hold = every): number =>
  (RUN_DEGREES.length - 1) * every + hold

/** Merc's run as one sung line: each note held, gliding into the next over its last 50 ms. */
export function runLine(doMidi: number, every: number): ContourPoint[] {
  const last = RUN_DEGREES.length - 1
  return RUN_DEGREES.flatMap((d, i) => {
    const at = i * every
    const f = hz(doMidi + d)
    const end = i === last ? at + every : at + every - GLIDE_SEC
    return [
      { t: at, hz: f },
      { t: end, hz: f },
    ]
  })
}

/** Where the smudged singer's voice is at `t` s into the run, in cents from do. */
export function smudgeCentsAt(t: number): number {
  const i = Math.min(RUN_DEGREES.length - 1, Math.floor(t / SMUDGE.every))
  const land = RUN_DEGREES[i] * 100 + SMUDGE.cents[i]
  if (i === 0) return land
  const from = RUN_DEGREES[i - 1] * 100 + SMUDGE.cents[i - 1]
  const u = Math.min(1, (t - i * SMUDGE.every) / SMUDGE.glide)
  return from + (land - from) * u
}

/** The smudged singer's line, sung in the soft tone: the first note held, each later one gliding for 0.12 s and held where it lands. */
export function smudgeLine(doMidi: number): ContourPoint[] {
  const at = (i: number): number =>
    hz(doMidi + RUN_DEGREES[i] + SMUDGE.cents[i] / 100)
  const points: ContourPoint[] = [{ t: 0, hz: at(0) }]
  RUN_DEGREES.forEach((_d, i) => {
    const start = i * SMUDGE.every
    if (i > 0) points.push({ t: start + SMUDGE.glide, hz: at(i) })
    points.push({ t: start + SMUDGE.every, hz: at(i) })
  })
  return points
}
