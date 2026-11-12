// ============================================================
// Staircase plays — the scales a staircase plays, note by note
// ============================================================
//
// Lesson 4's pace (Lesson 4 FACTS 57 to 60): a scale plays at 0.45 s a note,
// its last note 0.9 s; Stop on ti holds ti 1.2 s, and Land on do plays ti for
// 0.45 s, then do for 1.2 s; Slow doubles every length. Times are seconds
// from the press, every note timed from that one press so nothing drifts.

import { MAJOR_DEGREES, scaleNotes, whiteKeysFrom } from './major-scale'
import type { Degrees } from './stairs-scales'

/** One note of an example: its MIDI number, its onset and its length, seconds. */
export interface NoteEvent {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** A scale's pace (Lesson 4 FACTS 57). */
export const NOTE_SEC = 0.45
export const LAST_SEC = 0.9
/** Ti held after Stop on ti, and do after Land on do (Lesson 4 FACTS 58). */
export const HOLD_SEC = 1.2

/** Notes in turn, `NOTE_SEC` apart, the last one `last` long; `slow` 2 doubles every length. */
export function run(
  midis: readonly number[],
  last = LAST_SEC,
  slow = 1,
): NoteEvent[] {
  return midis.map((midi, i) => ({
    midi,
    at: i * NOTE_SEC * slow,
    dur: (i === midis.length - 1 ? last : NOTE_SEC) * slow,
  }))
}

/** Play up and Play down: do to do, and back; up another scale's stairs where a page draws them (Lesson 20's five). */
export const scaleUp = (
  tonic: number,
  slow = 1,
  degrees: Degrees = MAJOR_DEGREES,
): NoteEvent[] =>
  run(
    degrees.map((d) => tonic + d),
    LAST_SEC,
    slow,
  )
export const scaleDown = (tonic: number, slow = 1): NoteEvent[] =>
  run([...scaleNotes(tonic)].reverse(), LAST_SEC, slow)

/** Stop on ti: do up to ti, ti held. */
export const stopOnTi = (tonic: number, slow = 1): NoteEvent[] =>
  run(scaleNotes(tonic).slice(0, 7), HOLD_SEC, slow)

/** Land on do: ti, then do an octave above the start. */
export const landOnDo = (tonic: number, slow = 1): NoteEvent[] =>
  run([tonic + 11, tonic + 12], HOLD_SEC, slow)

/** A Group bracket's four notes: the first group (0) or the second (1). */
export const groupOf = (tonic: number, group: 0 | 1, slow = 1): NoteEvent[] =>
  run(scaleNotes(tonic).slice(group * 4, group * 4 + 4), LAST_SEC, slow)

/** White keys only: the white keys up an octave from a white start (Lesson 4 FACTS 60), none from a black one. */
export function whiteKeysRun(start: number, slow = 1): NoteEvent[] {
  const keys = whiteKeysFrom(start)
  return keys === null ? [] : run(keys, LAST_SEC, slow)
}

/** Seconds from an example's start to the end of its last note. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
  events.reduce((end, e) => Math.max(end, e.at + e.dur), 0)
