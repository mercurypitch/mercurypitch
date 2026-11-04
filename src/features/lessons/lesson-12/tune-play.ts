// ============================================================
// Lesson 12 tune play — a tune over the loop as one run, and its count of corners
// ============================================================
//
// Pure (WEB-SPEC, Toys 5; FACTS 35 to 37, 68, 72, 74). A tune play is one
// run: the loop's chords in the soft tone at 0.05 a voice, with Merc's
// "ooh" at 0.2 over them, every note timed from the press, so a chord and
// the tune's note that begins with it start in the same timer task and
// never drift apart (kit/run.ts). Slow doubles every length, the loop's
// with the tune's, 16.0 s. The steps' ring plays it (rooms.ts), and so does
// the hero's in the cold open, where Merc sings each of the tune's notes as
// it starts.
//
// A note of the tune that is a note of the chord under it lands on a corner
// of that chord's room. The count goes by the note's name against the
// chord's three (music.ts `onCorner`), never by measuring anything: tune 1
// ends on 11 of 15, tune 2 on 10 of 12, and tune 2 with even notes on 10 of
// 12 (FACTS 35 to 37).

import type { KeyName, TuneId, TuneNote } from './music'
import { BAR_SEC, LOOP_DEGREES, TUNE_IDS, tuneOf } from './music'
import type { SoundNote } from './sounds'
import { slow, tune } from './sounds'

/** How many of a tune's notes have landed, and how many of those on a corner. */
export interface Tally {
  readonly on: number
  readonly of: number
}

/** The count once the first `heard` of the tune's notes have begun: all of them by default. */
export function tallyOf(
  notes: readonly TuneNote[],
  heard = notes.length,
): Tally {
  const landed = notes.slice(0, heard)
  return { on: landed.filter((n) => n.corner).length, of: landed.length }
}

/** The tune a button's `data-tune` names, or null. */
export const tuneIdOf = (name: string | undefined): TuneId | null =>
  TUNE_IDS.find((id) => id === name) ?? null

/** A tune play's sound, and how to read its notes back as they start. */
export interface TuneSound {
  /** Every note of the run, the chords' voices and Merc's, by onset: chords first in each task. */
  readonly notes: readonly SoundNote[]
  /** The tune's own notes, in the key, at their written lengths. */
  readonly tune: readonly TuneNote[]
  /** How many times its written lengths the play takes: 2 under Slow. */
  readonly by: number
  /** Which of the tune's notes the run's `i`th note is, or null for a chord's voice. */
  sungAt(i: number): number | null
  /** The loop's chord a voice of the run's `i`th note belongs to, by degree, or null for a tune note. */
  chordAt(i: number): number | null
}

/** Tune `id` over the key's loop, as one run's notes, at twice its lengths under Slow. */
export function tuneSound(
  id: TuneId,
  key: KeyName,
  slowed: boolean,
): TuneSound {
  const by = slowed ? 2 : 1
  const notes = slow(tune(id, key), by)
  // the run's notes are sorted by onset, and the sort keeps Merc's in the
  // tune's own order, so the nth of Merc's is the tune's nth note
  const sung = new Map<number, number>()
  notes.forEach((n, i) => {
    if (n.kind === 'merc') sung.set(i, sung.size)
  })
  return {
    notes,
    tune: tuneOf(id, key),
    by,
    sungAt: (i) => sung.get(i) ?? null,
    chordAt: (i) => {
      const n = notes[i]
      if (n === undefined || sung.has(i)) return null
      return LOOP_DEGREES[Math.floor(n.t / (BAR_SEC * by) + 1e-6)] ?? null
    },
  }
}
