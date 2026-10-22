// ============================================================
// Lesson 4 examples — every sound on the page, at FACTS 56 to 63's timings
// ============================================================
//
// A scale plays at 0.45 s a note, its last note 0.9 s (FACTS 57); Stop on ti
// holds ti 1.2 s, and Land on do plays ti for 0.45 s, then do for 1.2 s
// (FACTS 58 and 59); Slow doubles every length. Times are seconds from the
// press, every note timed from that one press so nothing drifts. The tapped
// and played notes are the kit's soft tone; Merc's singing is Merc's "ooh".
//
// Sing it's model (FACTS 63) is three sung phrases: do re mi fa so fa mi re
// do at 0.8 s a note, the last 1.2 s; a 2 s rest; do re mi fa so la ti, ti
// held 2 s; a 0.6 s rest; do an octave up for 1.2 s: 18.2 s in all. Merc
// sings each phrase as one voice, gliding 50 ms into each new note, and the
// guide draws the same line, silent through the rests.

import { scaleNotes, whiteKeysFrom } from '@/features/lessons/kit/major-scale'
import { hz } from '@/features/lessons/kit/notes'
import type { GuidePoint } from '@/features/lessons/kit/slide-guide'
import type { ContourPoint, VoiceOptions } from '@/features/lessons/kit/sound'
import { contourVoice, Sound } from '@/features/lessons/kit/sound'

/** One note of an example: its MIDI number, its onset and its length, seconds. */
export interface NoteEvent {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** A scale's pace (FACTS 57). */
export const NOTE_SEC = 0.45
export const LAST_SEC = 0.9
/** Ti held after Stop on ti, and do after Land on do (FACTS 58). */
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

/** Play up and Play down: do to do, and back (FACTS 57). */
export const scaleUp = (tonic: number, slow = 1): NoteEvent[] =>
  run(scaleNotes(tonic), LAST_SEC, slow)
export const scaleDown = (tonic: number, slow = 1): NoteEvent[] =>
  run([...scaleNotes(tonic)].reverse(), LAST_SEC, slow)

/** Stop on ti: do up to ti, ti held (FACTS 58 and 59). */
export const stopOnTi = (tonic: number, slow = 1): NoteEvent[] =>
  run(scaleNotes(tonic).slice(0, 7), HOLD_SEC, slow)

/** Land on do: ti, then do an octave above the start. */
export const landOnDo = (tonic: number, slow = 1): NoteEvent[] =>
  run([tonic + 11, tonic + 12], HOLD_SEC, slow)

/** A Group bracket's four notes: the first group (0) or the second (1). */
export const groupOf = (tonic: number, group: 0 | 1, slow = 1): NoteEvent[] =>
  run(scaleNotes(tonic).slice(group * 4, group * 4 + 4), LAST_SEC, slow)

/** White keys only: the white keys up an octave from a white start (FACTS 60), none from a black one. */
export function whiteKeysRun(start: number, slow = 1): NoteEvent[] {
  const keys = whiteKeysFrom(start)
  return keys === null ? [] : run(keys, LAST_SEC, slow)
}

/** The words strip (FACTS 61): Tonic is C4 for a second; Scale degree and Solfège, C4, D4, E4. */
export const TONIC_NOTE: readonly NoteEvent[] = [{ midi: 60, at: 0, dur: 1 }]
export const FIRST_THREE: readonly NoteEvent[] = run([60, 62, 64])

/** Seconds from an example's start to the end of its last note. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
  events.reduce((end, e) => Math.max(end, e.at + e.dur), 0)

/** Runs `onNote` at each note's onset; resolves when the last note has ended. */
export function schedule(
  events: readonly NoteEvent[],
  onNote: (e: NoteEvent, i: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    events.forEach((e, i) => {
      window.setTimeout(() => onNote(e, i), e.at * 1000)
    })
    window.setTimeout(resolve, lengthOf(events) * 1000)
  })
}

export interface PlayOptions {
  /** Decided once, by the press: silent plays still run their visuals. */
  readonly audible: boolean
  /** The kit's soft tone (default) or Merc's "ooh". */
  readonly kind?: VoiceOptions['kind']
  readonly onNote?: (e: NoteEvent, i: number) => void
}

/** Plays an example note by note, with `onNote` hearing each as it starts. */
export function playNotes(
  events: readonly NoteEvent[],
  o: PlayOptions,
): Promise<void> {
  return schedule(events, (e, i) => {
    if (o.audible) Sound.voice(hz(e.midi), { kind: o.kind, dur: e.dur })
    o.onNote?.(e, i)
  })
}

// ---------------------------------------------------------------- Sing it

/** A note of Sing it's model, seconds. */
export const GUIDE_NOTE_SEC = 0.8
/** The glide into each new note of a phrase. */
const GLIDE_SEC = 0.05

/** The model's three phrases, as degrees above do, each with its start and its last note's length. */
const PHRASES: readonly {
  readonly at: number
  readonly degrees: readonly number[]
  readonly last: number
}[] = [
  { at: 0, degrees: [0, 2, 4, 5, 7, 5, 4, 2, 0], last: 1.2 },
  { at: 9.6, degrees: [0, 2, 4, 5, 7, 9, 11], last: 2 },
  { at: 17, degrees: [12], last: 1.2 },
]

/** The whole model, 18.2 s (FACTS 63). */
export const GUIDE_SEC = 18.2

/** Ti's 2 s hold in the model: where the guide's ring breathes. */
export const TI_HOLD = { from: 14.4, to: 16.4 } as const

/** The model's seventeen notes on a do of `doMidi`, with their times. */
export function guideNotes(doMidi: number): NoteEvent[] {
  return PHRASES.flatMap((p) =>
    p.degrees.map((d, i) => ({
      midi: doMidi + d,
      at: p.at + i * GUIDE_NOTE_SEC,
      dur: i === p.degrees.length - 1 ? p.last : GUIDE_NOTE_SEC,
    })),
  )
}

/** One phrase as points: each note held, gliding into the next. */
function phrasePoints(
  p: (typeof PHRASES)[number],
  doMidi: number,
): GuidePoint[] {
  const points: GuidePoint[] = []
  p.degrees.forEach((d, i) => {
    const at = p.at + i * GUIDE_NOTE_SEC
    const end = at + (i === p.degrees.length - 1 ? p.last : GUIDE_NOTE_SEC)
    points.push({ t: at, midi: doMidi + d })
    points.push({
      t: i === p.degrees.length - 1 ? end : end - GLIDE_SEC,
      midi: doMidi + d,
    })
  })
  return points
}

/** Merc's path on the guide: three phrases, silent through the two rests. */
export function guidePath(doMidi: number): GuidePoint[] {
  return PHRASES.flatMap((p, k) =>
    phrasePoints(p, doMidi).map((point, i) =>
      k > 0 && i === 0 ? { ...point, gap: true } : point,
    ),
  )
}

/** Each phrase as one sung line for the voice: its start, and its points from 0. */
export function guidePhrases(
  doMidi: number,
): { readonly at: number; readonly points: ContourPoint[] }[] {
  return PHRASES.map((p) => ({
    at: p.at,
    points: phrasePoints(p, doMidi).map((point) => ({
      t: point.t - p.at,
      hz: hz(point.midi),
    })),
  }))
}

/** Sings the model on `doMidi` in Merc's "ooh" (when `audible`); resolves when it has ended. */
export function singModel(doMidi: number, audible: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (audible)
      for (const phrase of guidePhrases(doMidi))
        window.setTimeout(
          () => void contourVoice(phrase.points, { kind: 'merc' }),
          phrase.at * 1000,
        )
    window.setTimeout(resolve, GUIDE_SEC * 1000)
  })
}
