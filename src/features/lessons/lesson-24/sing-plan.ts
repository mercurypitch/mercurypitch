// ============================================================
// Lesson 24 Sing it's plan — do on D, the two sets, and their words
// ============================================================
//
// The data and the words of Sing it (WEB-SPEC, Toys 6; FACTS 55 to 59), as
// pure functions, so every line is unit-tested without a microphone. Do is
// D3 for the lower voice and D4 for the higher, and Move do raises it up to
// five semitones, to G3 and G4, never lower (FACTS 56, 57): the drone sits
// on do, so and mi a fifth and a major third above it, at the piano's
// pitch. The first set holds do, so and mi for five seconds each; the
// second, so and mi for ten. A take is one run of a set. After the second
// set the summary reads that take's two holds, naming a hold it could not
// read, and says nothing with neither read.

import type { MoveReach } from '@/features/lessons/kit/move-do'
import { clampMove } from '@/features/lessons/kit/move-do'
import { nameHtml, sharpOf, signName } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** D3, MIDI: the lower voice's do, and its drone's, before Move do. */
export const D3 = 50

/** Do for each voice before Move do: D3, and D4 an octave up. */
export const DO: Readonly<Record<Voice, number>> = {
  lower: D3,
  higher: D3 + 12,
}

/** Move do's reach: five higher, to G, and none lower (FACTS 57). */
export const MOVE_REACH: MoveReach = { lower: 0, higher: 5 }

/** The three notes, semitones above do: the drone's own note, the fifth and the major third. */
export const DEGREE = { do: 0, so: 7, mi: 4 } as const
export type Degree = keyof typeof DEGREE

/** A set: its notes in the order sung, and each hold's length, seconds (FACTS 55). */
export interface HoldSet {
  readonly notes: readonly Degree[]
  readonly sec: number
}
export const SETS: Readonly<Record<1 | 2, HoldSet>> = {
  1: { notes: ['do', 'so', 'mi'], sec: 5 },
  2: { notes: ['so', 'mi'], sec: 10 },
}

/** Seconds of the singing Merc's note before each hold, alone and straight (FACTS 70). */
export const MODEL_SEC = 2
/** Seconds of the drone alone, each hold's Listen phase. */
export const DRONE_LISTEN_SEC = 2
/** The sing-along's three parts, seconds: the note alone, the quiet, then the drone with the singer (FACTS 70). */
export const ALONG = { note: 2, quiet: 1, drone: 5 } as const

/** Merc's level, and the drone's, under Merc's so the singer hears their own voice (WEB-SPEC, Audio, Levels; the lab sets it). */
export const MERC_GAIN = 0.2
export const DRONE_GAIN = 0.1

/** Do for `v` with Move do at `move`. */
export const doOf = (v: Voice, move: number): number =>
  DO[v] + clampMove(move, MOVE_REACH)

/** The note `d` for `v` with Move do at `move`. */
export const noteOf = (v: Voice, move: number, d: Degree): number =>
  doOf(v, move) + DEGREE[d]

/** A degree's name with its first letter raised: "Do". */
const title = (d: Degree): string => d[0].toUpperCase() + d.slice(1)

/** The note's name with its sign: "F♯3". */
export const noteName = (midi: number): string => signName(sharpOf(midi))

/** The hold's head over the chart: "So, A3". */
export const holdHead = (d: Degree, midi: number): string =>
  `${title(d)}, ${noteName(midi)}`

/** Do's readout under Move do: "Do: G3", its sign spoken. */
export const doNow = (midi: number): string => `Do: ${nameHtml(sharpOf(midi))}`

/** Who sings the model notes for a voice, as the lines name them. */
export const singerOf = (v: Voice): string => (v === 'lower' ? 'Merc' : 'Tavi')

/** The status line as the model note plays: "Merc sings so, A3, alone." */
export const modelStatus = (v: Voice, d: Degree, midi: number): string =>
  `${singerOf(v)} sings ${d}, ${noteName(midi)}, alone.`

/** The status line as a hold's Listen phase begins: "So, A3: listen to the drone." */
export const listenStatus = (d: Degree, midi: number): string =>
  `${holdHead(d, midi)}: listen to the drone.`

/** The status line as the sing-along's drone comes in under a note: "So, A3: sing with the drone." */
export const alongStatus = (d: Degree, midi: number): string =>
  `${holdHead(d, midi)}: sing with the drone.`

/** One second figure, as the hold reader writes its seconds: 9.1, 10. */
const secs = (s: number): string => String(Math.round(s * 10) / 10)

/** A hold of the second set as the summary reads it: in the band for so many of so many seconds, or no reading. */
export interface HeldNote {
  readonly d: Degree
  /** Seconds in the band and the hold's length, or null with no reading. */
  readonly read: { readonly inBand: number; readonly length: number } | null
}

/**
 * After the ten-second set: "This time the middle of your line was in the
 * band for 9.1 of 10 seconds on so, then 8.6 on mi.", naming a hold it
 * could not read ("...on so; there was no reading on mi."), and null with
 * neither read (WEB-SPEC, Toys 6, the set's rules).
 */
export function setSummary(
  notes: readonly HeldNote[],
  subject = 'the middle of your line',
): string | null {
  const read = notes.filter((n) => n.read !== null)
  const first = read[0]
  if (first?.read == null) return null
  let line = `This time ${subject} was in the band for ${secs(first.read.inBand)} of ${secs(first.read.length)} seconds on ${first.d}`
  for (const n of notes) {
    if (n === first) continue
    line +=
      n.read === null
        ? `; there was no reading on ${n.d}`
        : `, then ${secs(n.read.inBand)} on ${n.d}`
  }
  return `${line}.`
}
