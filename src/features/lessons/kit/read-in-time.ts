// ============================================================
// Read in time — a take read note by note in its own beats, anchored on the singer's first note
// ============================================================
//
// Lesson 18's Sing it (its WEB-SPEC, Toys 5, the in-time reader): the
// learner sings two written bars in time, with nothing playing, and each
// written note is then read in its own beats. Pure, so every rule is tested
// on synthetic takes (read-in-time.test.ts), as verify18.mjs runs them.
//
// - The anchor. The take's first run of voice at least 0.15 s long is the
//   singer's first note. Starting between a quarter of a beat before bar
//   1's first beat and two beats after it, it anchors the take: every
//   note's beats move by its distance from bar 1's first beat, early or
//   late, as The Chart's first tap anchors its bar. A steady delay, the
//   device's or the singer's, moves the first note with it and cancels out.
//   A run already going as the take opens (do hummed through the count-in),
//   or a first run outside the span, leaves the beats where they are
//   written; no later run is looked for, since it could be a later note.
// - The window. Each note is listened for from a quarter of a beat before
//   its beats to a quarter of a beat after them, anchored. Windows overlap,
//   and a frame counts for each window it falls in: each note is judged
//   alone, so a slip costs only that note.
// - Heard on its note. In its window, in time order, a voiced frame within
//   60 cents of the note, folded into one octave, adds its time to the
//   note's total, and one outside takes back half its time, never below
//   zero, as does a stretch with no voice: Sight-Singing's rule. At 0.45 s
//   the note is heard on its note, read from the frames that counted, as
//   their median folded distance with the octave they sat in. This only
//   finds the note: its line says "In the band" only within 35 cents.
// - Not heard on its note. Read only from the voiced frames in its own
//   beats, anchored, after a 0.15 s attack from its first beat: under 0.3 s
//   of them, or a median more than 60 cents off that sits within 60 cents
//   of a written note up to two places either side (another note sung
//   early or late, or a left-out note's neighbour coming in early), or any
//   such note in a take with no anchor, where late cannot be told from
//   wrong, gives "We didn't hear a steady note there."; otherwise the gap
//   from its own note, for a note held out of tune. No gap is measured from
//   the wrong note, and nothing reads when the voice came: timing is never
//   scored.
// - No voice: no window holds a voiced frame.
//
// Every value is new, chosen for a quarter note's 1 s at 60 BPM, and is set
// on a phone in the lab (WEB-SPEC, What the kit and the app still need,
// item 15). The lines name "the written note" (read-along.ts
// `readingLines`, take.ts `rungLine`).

import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { foldCents, median, preprocess } from '@/lib/mirror/metrics'
import type { NoteReading } from './read-along'
import { octaveLine } from './take'

/** Seconds of voice that make a run the singer's first note. */
export const ANCHOR_RUN_SEC = 0.15
/** Beats before and after bar 1's first beat the first note may start and still anchor the take. */
export const ANCHOR_EARLY_BEATS = 0.25
export const ANCHOR_LATE_BEATS = 2
/** Beats a note's window reaches either side of its own. */
export const WINDOW_BEATS = 0.25
/** Within this many cents, folded, a frame is on its note. */
export const ON_NOTE_CENTS = 60
/** Seconds on its note that hear a note. */
export const HEARD_SEC = 0.45
/** Seconds after a note's first beat before its own beats are read. */
export const OWN_ATTACK_SEC = 0.15
/** Seconds of voice in its own beats that a note not heard on its note needs to be read at all. */
export const OWN_VOICE_SEC = 0.3
/** Places either side within which another written note's pitch reads as that note sung early or late. */
export const NEIGHBOURS = 2
/** The most time one voiced frame stands for, s: a longer gap is a stretch with no voice. */
const MAX_HOP = 0.05

/** A written note: its MIDI note, and its first beat and length in beats from bar 1's first beat. */
export interface WrittenNote {
  readonly midi: number
  readonly beat: number
  readonly beats: number
}

export interface InTimeOptions {
  readonly notes: readonly WrittenNote[]
  readonly bpm: number
  /** Bar 1's first beat, on the frames' clock (the audio clock the start scheduled). */
  readonly bar1: number
  /** When the take opened, on the same clock: frames are kept from here, half a beat before bar 1. */
  readonly opened: number
}

/** A note's reading, and whether it was heard on its note. */
export interface InTimeNote extends NoteReading {
  readonly heard: boolean
}

export type InTimeReading =
  | { readonly voice: false }
  | {
      readonly voice: true
      /** Seconds the beats moved, early below 0; null with no anchor. */
      readonly shift: number | null
      readonly notes: readonly InTimeNote[]
    }

const NOT_STEADY: InTimeNote = { heard: false, d: null, octaveLine: null }

/** The voiced frames' runs: frames no further apart than a frame's hop. */
function runsOf(voiced: readonly VoicedFrame[]): VoicedFrame[][] {
  const runs: VoicedFrame[][] = []
  for (const f of voiced) {
    const run = runs.at(-1)
    const last = run?.at(-1)
    if (run !== undefined && last !== undefined && f.t - last.t <= MAX_HOP)
      run.push(f)
    else runs.push([f])
  }
  return runs
}

/**
 * The anchor: how far the singer's first note started from bar 1's first
 * beat, s, early below 0; null where the take's first run of 0.15 s or more
 * was going as the take opened, or started outside the span.
 */
export function anchorOf(
  voiced: readonly VoicedFrame[],
  o: Pick<InTimeOptions, 'bpm' | 'bar1' | 'opened'>,
): number | null {
  const spb = 60 / o.bpm
  const first = runsOf(voiced).find(
    (run) => run[run.length - 1].t - run[0].t >= ANCHOR_RUN_SEC - 1e-9,
  )
  if (first === undefined) return null
  const start = first[0].t
  if (start - o.opened <= MAX_HOP) return null
  const shift = start - o.bar1
  if (shift < -ANCHOR_EARLY_BEATS * spb - 1e-9) return null
  if (shift > ANCHOR_LATE_BEATS * spb + 1e-9) return null
  return shift
}

/** The voiced frames from `from` to `to`, by time. */
const between = (
  voiced: readonly VoicedFrame[],
  from: number,
  to: number,
): VoicedFrame[] => voiced.filter((f) => f.t >= from - 1e-9 && f.t <= to + 1e-9)

/** The time a frame stands for, from the one before it: at most a hop, none for the first. */
const stands = (frames: readonly VoicedFrame[], i: number): number =>
  i === 0 ? 0 : Math.min(Math.max(frames[i].t - frames[i - 1].t, 0), MAX_HOP)

/** Seconds of voice in `frames`. */
const voicedSec = (frames: readonly VoicedFrame[]): number =>
  frames.reduce((sum, _, i) => sum + stands(frames, i), 0)

/**
 * The distances, not folded, of the frames that heard a note in its window,
 * by read-along.ts's rule; null where it was not heard.
 */
function heardIn(
  frames: readonly VoicedFrame[],
  midi: number,
): number[] | null {
  const held: number[] = []
  let hold = 0
  const lose = (sec: number): void => {
    hold = Math.max(0, hold - sec / 2)
  }
  for (let i = 0; i < frames.length; i++) {
    // a stretch with no voice takes back half its time
    const gap = i === 0 ? 0 : frames[i].t - frames[i - 1].t
    if (gap > MAX_HOP) lose(gap - MAX_HOP)
    const d = frames[i].cents - midi * 100
    const dt = stands(frames, i)
    if (Math.abs(foldCents(d)) <= ON_NOTE_CENTS) {
      hold += dt
      held.push(d)
    } else lose(dt)
    if (hold >= HEARD_SEC - 1e-9) return held
  }
  return null
}

/** A reading from distances not folded: their median folded distance, and the octave they sat in. */
function readingOf(diffs: readonly number[], heard: boolean): InTimeNote {
  const d = median(diffs.map(foldCents))
  const octaves = Math.round(median(diffs) / 1200)
  return { heard, d, octaveLine: octaveLine(d, octaves === 0 ? 0 : octaves) }
}

/** Whether `frames` sit, by their median, within 60 cents of the note at a place up to two either side of `i`. */
const onANeighbour = (
  frames: readonly VoicedFrame[],
  notes: readonly WrittenNote[],
  i: number,
): boolean =>
  notes.some(
    (m, j) =>
      j !== i &&
      Math.abs(j - i) <= NEIGHBOURS &&
      Math.abs(median(frames.map((f) => foldCents(f.cents - m.midi * 100)))) <=
        ON_NOTE_CENTS,
  )

/** Reads a take of written notes sung in time: each note in its own beats, anchored on the singer's first. */
export function readInTime(
  frames: readonly F0Frame[],
  o: InTimeOptions,
): InTimeReading {
  const voiced = preprocess(frames.filter((f) => f.t >= o.opened - 1e-9))
  const spb = 60 / o.bpm
  const shift = anchorOf(voiced, o)
  const at = (beat: number): number => o.bar1 + (shift ?? 0) + beat * spb
  const windows = o.notes.map((n) =>
    between(
      voiced,
      at(n.beat - WINDOW_BEATS),
      at(n.beat + n.beats + WINDOW_BEATS),
    ),
  )
  if (windows.every((w) => w.length === 0)) return { voice: false }
  const notes = o.notes.map((n, i): InTimeNote => {
    const held = heardIn(windows[i], n.midi)
    if (held !== null) return readingOf(held, true)
    if (shift === null) return NOT_STEADY
    // its own beats end where the next beat starts, so the next note's
    // first frame is never this one's
    const own = voiced.filter(
      (f) =>
        f.t >= at(n.beat) + OWN_ATTACK_SEC - 1e-9 &&
        f.t < at(n.beat + n.beats) - 1e-9,
    )
    if (voicedSec(own) < OWN_VOICE_SEC - 1e-9) return NOT_STEADY
    const diffs = own.map((f) => f.cents - n.midi * 100)
    const off = Math.abs(median(diffs.map(foldCents))) > ON_NOTE_CENTS
    if (off && onANeighbour(own, o.notes, i)) return NOT_STEADY
    return readingOf(diffs, false)
  })
  return { voice: true, shift, notes }
}

/**
 * When the last note's window closes, on the frames' clock, moved by the
 * anchor the frames so far give: a take listens until then (kit/listen.ts
 * `until`), so up to 2.25 s after the final bar line for a singer who came
 * in two beats late. The anchor is settled 2 beats and 0.15 s after bar 1's
 * first beat, long before the bars end.
 */
export function windowsClose(
  frames: readonly F0Frame[],
  o: InTimeOptions,
): number {
  const voiced = preprocess(frames.filter((f) => f.t >= o.opened - 1e-9))
  const end = Math.max(...o.notes.map((n) => n.beat + n.beats))
  return (
    o.bar1 + (anchorOf(voiced, o) ?? 0) + ((end + WINDOW_BEATS) * 60) / o.bpm
  )
}
