// ============================================================
// Lesson 18 Sing it's take — two bars sung in time, read note by note
// ============================================================
//
// Loaded on the first Start, so first paint carries no reader (sing.ts).
// The take opens half a beat before bar 1's first beat, 0.5 s after the
// last click starts, and listens until the last note's window closes, a
// quarter of a beat after bar 2 ends, moved by the anchor: up to 2.25 s
// after the final bar line for a singer who came in two beats late
// (WEB-SPEC, Toys 5, state 6; FACTS 52, 82). Nothing plays while it runs.
// The in-time reader (kit/read-in-time.ts) reads each written note in its
// own beats, anchored on the singer's first note, and each note's line
// names "the written note", its syllable first: "So · In the band: 20
// cents above the written note.", or "Mi · We didn't hear a steady note
// there.", with no count, no score and nothing on timing (FACTS 54).
//
// The frames' clock starts with the take (kit/listen.ts `takeFrames`), on
// the page's clock; the beat clock gives bar 1's first beat on that clock
// (`pageTimeOfBeat`), so the take knows where bar 1 falls in its frames.
//
// The pitch line comes with the lines, for the page to draw after the take
// and never during it (Lesson 16's sing-chart.ts): on the bars' time axis,
// moved by the anchor as the reader moves the beats, each written note an
// amber band over its own beats, as long as the note sounds, and the voice
// in violet, each frame folded into the octave of the written note nearest
// it, with the octave named in a tag when most of the voice sat an octave
// or more away (FACTS 53).

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import type { Rung } from '@/features/lessons/kit/band-chart-rungs'
import { octavesOf } from '@/features/lessons/kit/band-words'
import type { Listener } from '@/features/lessons/kit/listen'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { readingLines } from '@/features/lessons/kit/read-along'
import type { InTimeOptions, InTimeReading, WrittenNote, } from '@/features/lessons/kit/read-in-time'
import { readInTime, WINDOW_BEATS, windowsClose, } from '@/features/lessons/kit/read-in-time'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type { PitchLine } from '@/features/lessons/lesson-16/sing-chart'
import type { F0Frame } from '@/lib/mirror/metrics'
import { foldCents, median, preprocess } from '@/lib/mirror/metrics'
import { OPEN_BEATS } from './reads'

export type { PitchLine } from '@/features/lessons/lesson-16/sing-chart'
export { drawPitchLine } from '@/features/lessons/lesson-16/sing-chart'

/** The longest a take runs once the voice has begun, s: a cap, since the last window's close ends it first. */
const RUN_CAP_SEC = 30

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  /** The written notes, each with its first beat and length in beats from bar 1's first beat. */
  readonly notes: readonly WrittenNote[]
  /** Each note's syllable, for its line: "Do". */
  readonly labels: readonly string[]
  readonly bpm: number
  /** Bar 1's first beat, ms on the page's clock (the beat clock's `pageTimeOfBeat`). */
  readonly bar1: number
  /** Abandoned: the section left or the page hidden. */
  readonly cancelled: () => boolean
}

/** How a take ended. */
export type TakeEnd =
  | { readonly kind: 'left' }
  | {
      readonly kind: 'read'
      /** A note's window held a voiced frame. */
      readonly voiced: boolean
      /** One line a note, in order. */
      readonly lines: readonly string[]
      /** The pitch line to draw after the take; null when no voice came. */
      readonly pitch: PitchLine | null
    }

/** A stretch this long with no voiced frame breaks the line, s: several frames missed in a row, a breath or a stop. */
const BREAK_SEC = 0.1

/** Within this many cents of a written note, in any octave, a frame says which octave the voice sat in (`octaveTag`'s reach). */
const OCTAVE_REACH = 50

/** A frame's pitch against the written note nearest it in any octave: the note, and its distance unfolded and folded. */
function nearest(
  cents: number,
  notes: readonly number[],
): { midi: number; raw: number; folded: number } {
  let best = { midi: notes[0], raw: 0, folded: Infinity }
  for (const midi of notes) {
    const raw = cents - midi * 100
    const folded = foldCents(raw)
    if (Math.abs(folded) < Math.abs(best.folded)) best = { midi, raw, folded }
  }
  return best
}

/**
 * The take's pitch line over its written notes, on the bars' time axis
 * from half a beat before bar 1 to the last window's close, moved by the
 * reading's anchor; null with no voice.
 */
export function pitchLineOf(
  frames: readonly F0Frame[],
  o: InTimeOptions,
  reading: InTimeReading,
): PitchLine | null {
  if (!reading.voice) return null
  const spb = 60 / o.bpm
  const midis = o.notes.map((n) => n.midi)
  const end = Math.max(...o.notes.map((n) => n.beat + n.beats))
  const origin = o.bar1 + (reading.shift ?? 0) - OPEN_BEATS * spb
  const seconds = (OPEN_BEATS + end + WINDOW_BEATS) * spb
  const fromDo = (midi: number): number => (midi - midis[0]) * 100
  const rungs: Rung[] = o.notes.map((n) => {
    const from = (OPEN_BEATS + n.beat) * spb
    return { c: fromDo(n.midi), from, to: from + heldSeconds(n.beats, o.bpm) }
  })
  const line: TracePoint[] = []
  const octaves: number[] = []
  let before: number | null = null
  for (const f of preprocess(frames.filter((x) => x.t >= o.opened))) {
    const t = f.t - origin
    if (t < 0 || t > seconds) continue
    if (before !== null && t - before > BREAK_SEC)
      line.push({ t: (before + t) / 2, c: null })
    const n = nearest(f.cents, midis)
    line.push({ t, c: fromDo(n.midi) + n.folded })
    if (Math.abs(n.folded) <= OCTAVE_REACH)
      octaves.push(octavesOf(n.raw, n.folded))
    before = t
  }
  return {
    seconds,
    rungs,
    line,
    octaves: octaves.length === 0 ? 0 : Math.round(median(octaves)),
  }
}

/** One take of two bars in time: listened for until the last window closes, then read note by note. */
export async function runTake(c: TakeContext): Promise<TakeEnd> {
  const spb = 60 / c.bpm
  // the frames' clock starts here, with the take
  const opened = performance.now()
  const o: InTimeOptions = {
    notes: c.notes,
    bpm: c.bpm,
    bar1: (c.bar1 - opened) / 1000,
    opened: 0,
  }
  const end = Math.max(...c.notes.map((n) => n.beat + n.beats))
  const frames = await c.mod.takeFrames(c.listener, {
    // with no voice at all, the take ends where an unmoved last window closes
    wait: o.bar1 + (end + WINDOW_BEATS) * spb,
    run: RUN_CAP_SEC,
    until: (fs) => (fs.at(-1)?.t ?? 0) >= windowsClose(fs, o),
    cancelled: c.cancelled,
  })
  if (frames === null) return { kind: 'left' }
  const reading = readInTime(frames, o)
  if (!reading.voice)
    return { kind: 'read', voiced: false, lines: [], pitch: null }
  return {
    kind: 'read',
    voiced: true,
    lines: readingLines(c.labels, reading.notes),
    pitch: pitchLineOf(frames, o, reading),
  }
}
