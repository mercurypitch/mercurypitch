// ============================================================
// Sing It in Time: what Merc says, before, during and after a run
// ============================================================
//
// Merc says the drill (the stage's rule for every drill): its brief before a
// run, one line for each moment of it (his do, the count-in's four beats,
// then a line for each note as its beat comes), a line on each tune once it
// is heard, and after the run the one thing worth singing again.
//
// A note's line names its syllable only while the names are on: with them
// off, the staff is all the singer has, and Merc says only the count.
// Once a tune is over its notes are named either way.
//
// The words are the lessons' where the lessons have them: "We didn't hear a
// steady note there" for a note not heard (Lesson 18 FACTS 54), and the
// count-in singers use, "one, two, ready, sing". Pure.

import type { NoteVerdict } from './take-judge'
import type { Tune, TuneNote } from './tune-plan'
import { BAR_BEATS, levelFor, levelWords, TUNES_PER_RUN } from './tune-plan'

/** Merc's brief, before a run. */
export const BRIEF =
  "I give you do, then the click counts one bar. Keep reading: the beat won't wait."

/** Under the brief: the run's length, tempo and what its tunes hold. */
export function hintLine(level: number): string {
  const lv = levelFor(level)
  return `${TUNES_PER_RUN} tunes · ${lv.bpm} BPM · ${levelWords(lv)}`
}

/** While Merc's do sounds. */
export const doLine = (tune: Tune): string =>
  `This is do. The tune is in ${tune.key.name} major.`

const COUNT = ['One', 'two', 'ready', 'sing'] as const

/** The count-in so far, beat `count` of 4: "One, two, ready". */
export function countLine(count: number): string {
  const said = COUNT.slice(0, Math.max(1, Math.min(4, count)))
  return `${said.join(', ')}${count >= 4 ? '!' : '.'}`
}

const capital = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1)

/** Where a note's beat falls, counted: "on 3", "on the and of 2". */
function countOf(note: TuneNote): string {
  const count = (Math.floor(note.beat) % BAR_BEATS) + 1
  const offBeat = note.beat % 1 !== 0
  if (offBeat) return `on the and of ${count}`
  if (note.beats >= 2) return `on ${count}, hold ${count + 1}`
  return `on ${count}`
}

/** The line for the note whose beat has come: "Mi, on 3." or, with the names off, "On 3." */
export function noteLine(note: TuneNote, names: boolean): string {
  const count = countOf(note)
  return names ? `${capital(note.syllable)}, ${count}.` : `${capital(count)}.`
}

/** A note in a run, by its syllable and its tune: "fa in tune 2". */
function where(tune: Tune, index: number, tuneIndex: number | null): string {
  const syllable = tune.notes[index].syllable
  return tuneIndex === null ? syllable : `${syllable} in tune ${tuneIndex + 1}`
}

/** "a touch flat", "flat": how far off a note sat, beyond the hit band. */
function pitchWords(cents: number): string {
  const side = cents < 0 ? 'flat' : 'sharp'
  return Math.abs(cents) <= 60 ? `a touch ${side}` : side
}

/** How much a note wants singing again: not heard most, then off, then a timing slip, then a note at the band's edge. */
function needOf(v: NoteVerdict): number {
  if (v.pitch === 'not-heard') return 4
  if (v.pitch === 'off') return 3
  if (v.timing === 'early' || v.timing === 'late') return 2
  if (v.cents !== null && Math.abs(v.cents) > 35) return 1
  return 0
}

interface Worst {
  readonly index: number
  readonly v: NoteVerdict
}

/** The tune's note most worth singing again, the first of equals; null when none needs it. */
function worstNote(verdicts: readonly (NoteVerdict | null)[]): Worst | null {
  let best: Worst | null = null
  for (let index = 0; index < verdicts.length; index++) {
    const v = verdicts[index]
    if (v === null || needOf(v) === 0) continue
    if (best === null || needOf(v) > needOf(best.v)) best = { index, v }
  }
  return best
}

/** What went wrong with a note, as a clause: "came in late and a touch flat". */
function slipOf(v: NoteVerdict): string {
  const parts: string[] = []
  if (v.timing === 'early' || v.timing === 'late')
    parts.push(`came in ${v.timing}`)
  if (v.pitch === 'off' && v.cents !== null)
    parts.push(`sat ${pitchWords(v.cents)}`)
  else if (v.cents !== null && Math.abs(v.cents) > 35)
    parts.push(
      parts.length === 0 ? `sat ${pitchWords(v.cents)}` : pitchWords(v.cents),
    )
  return parts.join(' and ')
}

/** Merc's line on a tune just sung. */
export function tuneLine(
  tune: Tune,
  verdicts: readonly (NoteVerdict | null)[],
  voice: boolean,
): string {
  if (!voice) return "I didn't hear you that time. Sing out on the next one."
  const total = tune.notes.length
  const inTune = verdicts.filter((v) => v?.pitch === 'in-tune').length
  const head =
    inTune === total ? `All ${total} in tune` : `${inTune} of ${total} in tune`
  const worst = worstNote(verdicts)
  if (worst === null) return `${head}, on the beat.`
  const name = capital(where(tune, worst.index, null))
  if (worst.v.pitch === 'not-heard')
    return `${head}. We didn't hear a steady note on ${where(tune, worst.index, null)}.`
  return `${head}. ${name} ${slipOf(worst.v)}.`
}

/** The beats to count out loud before a note, its own last: "3, 4". */
function countsBefore(note: TuneNote): string {
  const count = (Math.floor(note.beat) % BAR_BEATS) + 1
  const before = count === 1 ? BAR_BEATS : count - 1
  return `${before}, ${count}`
}

/** Merc's line after a run: the one thing worth singing again, or the next level. */
export function coachLine(
  tunes: readonly Tune[],
  marks: readonly (readonly (NoteVerdict | null)[])[],
  shifts: readonly (number | null)[],
): string {
  const heard = marks.flat().some((v) => v !== null && v.pitch !== 'not-heard')
  if (!heard)
    return "I didn't hear a note. Check the microphone, then sing along on the next run."
  // the one that most wants singing again, across the run; a note only at
  // the band's edge is not worth a line of its own
  let chosen: (Worst & { readonly tune: number }) | null = null
  for (let tune = 0; tune < marks.length; tune++) {
    const worst = worstNote(marks[tune])
    if (worst === null || needOf(worst.v) < 2) continue
    if (chosen === null || needOf(worst.v) > needOf(chosen.v))
      chosen = { ...worst, tune }
  }
  const came = shifts.some(
    (s, i) => s !== null && s > (0.3 * 60) / tunes[i].bpm,
  )
  if (chosen === null) {
    if (came)
      return 'Every note in tune. You came in after the beat, so I counted from your first note: try coming in on 1.'
    return 'Every note in tune and on the beat. Ready for the next level.'
  }
  const tune = tunes[chosen.tune]
  const note = tune.notes[chosen.index]
  const name = capital(where(tune, chosen.index, chosen.tune))
  if (chosen.v.pitch === 'not-heard')
    return `We didn't hear a steady note on ${where(tune, chosen.index, chosen.tune)}. Keep the beat going, and come in on the next note.`
  if (chosen.v.pitch === 'off')
    return `${name} ${slipOf(chosen.v)}. Hear do in your head, find ${note.syllable} from it, then sing it again.`
  return `${name} ${slipOf(chosen.v)}. Count ${countsBefore(note)} out loud once, then sing it again.`
}
