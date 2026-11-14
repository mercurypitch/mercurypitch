// ============================================================
// Read-along — a take that follows the voice along written notes
// ============================================================
//
// Lesson 16's Sing it (its WEB-SPEC, Toys 6, the cursor reader): the
// learner reads a phrase from the staff at their own pace, and the page
// lights each next note as the voice passes the one lit. Pure, so every
// step is tested on synthetic frames (read-along.test.ts).
//
// A page feeds it the take's voiced frames as they arrive, the ones Voice
// Mirror's `preprocess` keeps (as `readTake` takes them), and the newest
// frame's time, voiced or not. The first note starts at the first voiced
// frame. Each frame's distance from the lit note is folded into one octave
// (`foldCents`): a frame within 60 cents adds its time to the note's hold,
// and a frame outside it, or a stretch with no voice, takes back half its
// time, never below zero, as Sight-Singing does. At 0.45 s of hold the note
// passes and the next lights; 8 s after a note began the next lights anyway
// (Lesson 16 FACTS 45). The take is done when the last note passes or moves
// on, so a page's take can end there (kit/listen.ts `until`).
//
// Each note is then read on its own: one passed by its hold, from the
// frames that counted towards it, as their median folded distance with the
// octave they sat in; one the 8 s moved past, by `readTake` over its
// frames, which says where there was too little steady voice. The lines
// name the written note (take.ts `rungLine`), and none counts, scores or
// celebrates (FACTS 47).

import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { foldCents, median } from '@/lib/mirror/metrics'
import type { TakeReading } from './take'
import { octaveLine, readTake, rungLine } from './take'

/** Within this many cents of the lit note a frame counts towards it (FACTS 45). */
export const WINDOW_CENTS = 60
/** Seconds of hold that pass a note. */
export const PASS_SEC = 0.45
/** Seconds after a note began that the next lights anyway. */
export const MOVE_ON_SEC = 8
/** The most time one voiced frame stands for, s: past it, a gap is a stretch with no voice. */
const MAX_HOP = 0.05
/**
 * Seconds behind the newest frame that a stretch with no voice is counted
 * up to: the newest frames' voicing can still change as the median filter
 * sees the frames after them.
 */
const SETTLE_SEC = 0.1

/** How a note ended: its hold passed it, or the 8 s moved past it. */
export type Passed = 'hold' | 'time'

/** One written note's stretch of the take. */
export interface NoteRun {
  /** When it lit and when it passed, on the frames' clock. */
  readonly start: number
  readonly end: number | null
  readonly how: Passed | null
  /** The distances, in cents and not folded, of the frames that counted towards it. */
  readonly held: readonly number[]
}

export interface ReadAlong {
  /** The lit note's place in the phrase; the phrase's length once done, -1 before the voice. */
  readonly current: number
  readonly done: boolean
  readonly runs: readonly NoteRun[]
  /**
   * Takes in the voiced frames so far (any already taken are skipped) and the
   * newest frame's time, voiced or not; returns the lit note's place.
   */
  feed(voiced: readonly VoicedFrame[], now: number): number
}

/** A read-along over `notes`, the written notes as MIDI notes, in order. */
export function readAlong(notes: readonly number[]): ReadAlong {
  interface Run {
    start: number
    end: number | null
    how: Passed | null
    held: number[]
  }
  const runs: Run[] = []
  let cur = -1
  let hold = 0
  // the time accounted for so far
  let clock = -Infinity

  const done = (): boolean => cur >= notes.length
  const lose = (sec: number): void => {
    hold = Math.max(0, hold - sec / 2)
  }
  const light = (i: number, t: number): void => {
    cur = i
    hold = 0
    if (i < notes.length)
      runs.push({ start: t, end: null, how: null, held: [] })
  }
  const pass = (t: number, how: Passed): void => {
    const r = runs[cur]
    r.end = t
    r.how = how
    light(cur + 1, t)
  }
  /** Moves past every note whose 8 s ran out by `t`. */
  const timeTo = (t: number): void => {
    while (!done() && t - runs[cur].start >= MOVE_ON_SEC)
      pass(runs[cur].start + MOVE_ON_SEC, 'time')
  }

  function take(f: VoicedFrame): void {
    if (cur < 0) {
      light(0, f.t)
      clock = f.t
    }
    const gap = f.t - clock
    if (gap > MAX_HOP) lose(gap - MAX_HOP)
    timeTo(f.t)
    clock = f.t
    if (done()) return
    const d = f.cents - notes[cur] * 100
    const dt = Math.min(Math.max(gap, 0), MAX_HOP)
    if (Math.abs(foldCents(d)) <= WINDOW_CENTS) {
      hold += dt
      runs[cur].held.push(d)
    } else lose(dt)
    if (hold >= PASS_SEC - 1e-9) pass(f.t, 'hold')
  }

  return {
    get current() {
      return cur
    },
    get done() {
      return done()
    },
    get runs() {
      return runs
    },
    feed(voiced, now) {
      for (const f of voiced) {
        if (done()) break
        if (f.t > clock) take(f)
      }
      // a stretch with no voice, up to a moment the filter has settled
      const settled = now - SETTLE_SEC
      if (cur >= 0 && !done() && settled > clock) {
        lose(settled - clock)
        clock = settled
        timeTo(settled)
      }
      return cur
    },
  }
}

/** A note's reading: its folded distance (null where there was too little steady voice) and its octave line. */
export type NoteReading = Pick<TakeReading, 'd' | 'octaveLine'>

const NOT_STEADY: NoteReading = { d: null, octaveLine: null }

/**
 * Each note's reading after the take: from its held frames where its hold
 * passed it, by `readTake` over its stretch of `frames` (the take's raw
 * frames) where the 8 s moved past it, and not steady where the take ended
 * before it.
 */
export function readNotes(
  along: ReadAlong,
  notes: readonly number[],
  frames: readonly F0Frame[],
): NoteReading[] {
  return notes.map((midi, i) => {
    const r = i < along.runs.length ? along.runs[i] : null
    if (r === null || r.how === null) return NOT_STEADY
    if (r.how === 'hold' && r.held.length > 0) {
      const d = median(r.held.map(foldCents))
      const octaves = Math.round(median([...r.held]) / 1200)
      return { d, octaveLine: octaveLine(d, octaves === 0 ? 0 : octaves) }
    }
    const end = r.end ?? Infinity
    const read = readTake(
      frames.filter((f) => f.t >= r.start && f.t < end),
      midi,
    )
    return read.steady ? read : NOT_STEADY
  })
}

/** What a take's lines name, beside the note each was measured against. */
export interface LinesOptions {
  /** The note a gap is measured from: "the written note" unless given (Lesson 26's "your part's note"). */
  readonly whose?: string
  /** The part another voice sang under the take: whose it is, "Merc's", and each of its notes' syllables. */
  readonly other?: {
    readonly whose: string
    readonly labels: readonly string[]
  }
}

/**
 * Each note's line, its label first: "Re · In the band: 20 cents below the
 * written note.", or, for a note sung on the note the other part was
 * sounding (read-in-time.ts), "Do · That was Merc's note: mi.", with no
 * gap, no cause and no advice.
 */
export const readingLines = (
  labels: readonly string[],
  readings: readonly (NoteReading & { readonly other?: number })[],
  o: LinesOptions = {},
): string[] =>
  readings.map((r, i) => {
    const label = labels[i] ?? ''
    const other = r.other === undefined ? undefined : o.other?.labels[r.other]
    if (other !== undefined && o.other !== undefined)
      return `${label} · That was ${o.other.whose} note: ${other}.`
    return rungLine(label, r, o.whose ?? 'the written note')
  })
