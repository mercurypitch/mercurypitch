// ============================================================
// Leap's rounds — the leaps of a run and where they sit
// ============================================================
//
// Each round is one leap: Merc's note and the target, both in the singer's
// own window so either sits where the voice sings. The window is the
// singer's (Echo's: the voiceprint's range, else the voice type's), held to
// what a phone's speaker carries well, as Home note's is. A leap wider than
// the window is placed about its middle, still on notes a phone carries.
//
// A run takes the level's leaps in turn, each as often as the others (two
// fourths, two fifths and two sixths at Singer), shuffled so no leap
// follows itself where another can; Merc's note never repeats the round
// before it. Pure: the controller passes its random source in, a test a
// seeded one.

import type { LeapKind, LeapLevel } from './leap-rules'
import { sameLeap } from './leap-rules'

/** One round: the leap, from Merc's note to the target. */
export interface LeapRound {
  /** 0 for the first round. */
  readonly index: number
  readonly kind: LeapKind
  /** Merc's note, MIDI (whole): the near ledge. */
  readonly from: number
  /** The target, MIDI (whole): the far ledge. */
  readonly to: number
}

/** The notes a round may use, MIDI, inclusive. */
export interface NoteWindow {
  readonly low: number
  readonly high: number
}

/** The lowest and highest note a leap may use: C3 and E5. */
export const AUDIBLE_LOW = 48
export const AUDIBLE_HIGH = 76
/** With nothing known of the singer: F3 to F4. */
const DEFAULT_WINDOW: NoteWindow = { low: 53, high: 65 }

/** The window a run draws its leaps from: the singer's, in the audible band. */
export function roundWindow(
  singer: { readonly low: number; readonly high: number } | null,
): NoteWindow {
  if (
    singer === null ||
    !Number.isFinite(singer.low) ||
    !Number.isFinite(singer.high) ||
    singer.high < singer.low
  ) {
    return DEFAULT_WINDOW
  }
  const low = Math.max(AUDIBLE_LOW, Math.ceil(singer.low))
  const high = Math.min(AUDIBLE_HIGH, Math.floor(singer.high))
  return high >= low ? { low, high } : DEFAULT_WINDOW
}

/** A whole number from `low` to `high`, inclusive. */
function between(low: number, high: number, random: () => number): number {
  const count = high - low + 1
  return low + Math.min(count - 1, Math.floor(random() * count))
}

/**
 * Merc's note for a leap of `kind` in `window`, never `previous` where the
 * window leaves a choice. A leap wider than the window sits about its
 * middle, inside the audible band.
 */
export function pickFrom(
  kind: LeapKind,
  window: NoteWindow,
  previous: number | null,
  random: () => number,
): number {
  const span = kind.up ? kind.size : -kind.size
  const lowest = Math.max(window.low, window.low - span)
  const highest = Math.min(window.high, window.high - span)
  if (lowest > highest) {
    // Wider than the window: its middle on the window's middle.
    const middle = (window.low + window.high) / 2
    const from = Math.round(middle - span / 2)
    const floor = Math.max(AUDIBLE_LOW, AUDIBLE_LOW - span)
    const ceiling = Math.min(AUDIBLE_HIGH, AUDIBLE_HIGH - span)
    return Math.min(ceiling, Math.max(floor, from))
  }
  const first = between(lowest, highest, random)
  if (previous === null || first !== previous || highest === lowest) {
    return first
  }
  // Any other note of the choice, round the range.
  const count = highest - lowest + 1
  const step = 1 + Math.min(count - 2, Math.floor(random() * (count - 1)))
  return lowest + ((first - lowest + step) % count)
}

/**
 * The run's leaps in order: each of the level's as often as the others
 * (the rest spread over a shuffle when the count does not divide), shuffled
 * so no leap follows itself where another can.
 */
export function leapOrder(
  leaps: readonly LeapKind[],
  count: number,
  random: () => number,
): LeapKind[] {
  if (leaps.length === 0) return []
  const pool: LeapKind[] = []
  while (pool.length + leaps.length <= count) pool.push(...leaps)
  const rest = [...leaps]
  while (pool.length < count) {
    pool.push(rest.splice(Math.floor(random() * rest.length), 1)[0])
  }
  // Draw one at a time, never the last one drawn while another is left.
  const order: LeapKind[] = []
  while (pool.length > 0) {
    const last = order[order.length - 1]
    const fresh = pool
      .map((kind, i) => ({ kind, i }))
      .filter((entry) => last === undefined || !sameLeap(entry.kind, last))
    const choices =
      fresh.length > 0 ? fresh : pool.map((kind, i) => ({ kind, i }))
    const pick =
      choices[
        Math.min(choices.length - 1, Math.floor(random() * choices.length))
      ]
    order.push(pick.kind)
    pool.splice(pick.i, 1)
  }
  return order
}

/** The run's rounds, at `level`, in `window`. */
export function planRounds(
  count: number,
  window: NoteWindow,
  level: LeapLevel,
  random: () => number,
): LeapRound[] {
  const rounds: LeapRound[] = []
  for (const [index, kind] of leapOrder(level.leaps, count, random).entries()) {
    const previous = rounds[index - 1]?.from ?? null
    const from = pickFrom(kind, window, previous, random)
    rounds.push({
      index,
      kind,
      from,
      to: from + (kind.up ? kind.size : -kind.size),
    })
  }
  return rounds
}
