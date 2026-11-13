// ============================================================
// Take in time — written notes sung in time, read note by note
// ============================================================
//
// Lesson 18's take (its WEB-SPEC, Toys 5, state 6; FACTS 52, 82), which
// Lesson 26 sings against a part: loaded on the first Start, so first
// paint carries no reader. The take opens half a beat before bar 1's
// first beat, 0.5 s after the count-in's last click starts (`OPEN_BEATS`,
// which the page reads from this module once it has loaded, to know when
// to open it), and listens until the last note's window closes, a quarter
// of a beat after the last bar ends, moved by the anchor: up to 2.25 s
// after the final bar line for a singer who came in two beats late. The
// in-time reader (read-in-time.ts) reads each written note in its own
// beats, anchored on the singer's first note, and each note's line names
// "the written note", its syllable first: "So · In the band: 20 cents
// above the written note.", or "Mi · We didn't hear a steady note there.",
// with no count, no score and nothing on timing (Lesson 18 FACTS 54).
//
// The frames' clock starts with the take (listen.ts `takeFrames`), on the
// page's clock; the beat clock gives bar 1's first beat on that clock
// (`pageTimeOfBeat`), so the take knows where bar 1 falls in its frames.
//
// Lesson 26 sings it against a part another voice sings from bar 1
// (`other`): the reader hears a note sung on that part's note as theirs,
// "Do · That was Merc's note: mi.", and the lines measure a gap from "your
// part's note" (`whose`). The page draws its cursor every frame of the take
// (`onFrame`), since the hush that keeps the part sounding stops the beat
// clock that counted in.
//
// The pitch line comes with the lines, for the page to draw after the take
// and never during it (pitch-line.ts): on the bars' time axis, moved by the
// anchor as the reader moves the beats, each written note an amber band
// over its own beats, as long as the note sounds, and the voice in violet,
// each frame folded into the octave of the written note nearest it, with
// the octave named in a tag when most of the voice sat an octave or more
// away (Lesson 18 FACTS 53).

import type { F0Frame } from '@/lib/mirror/metrics'
import { foldCents, median, preprocess } from '@/lib/mirror/metrics'
import type { TracePoint } from './band-chart'
import type { Rung } from './band-chart-rungs'
import { inBand, octavesOf } from './band-words'
import type { Listener } from './listen'
import type { ListenModule } from './mic-hold'
import type { PitchLine } from './pitch-line'
import { readingLines } from './read-along'
import type { InTimeOptions, InTimeReading, WrittenNote } from './read-in-time'
import { readInTime, WINDOW_BEATS, windowsClose } from './read-in-time'
import { heldSeconds } from './rhythm-model'

export type { PitchLine } from './pitch-line'
export { drawPitchLine } from './pitch-line'

/** The take opens this many beats before bar 1's first beat: 0.5 s after the count-in's last click starts (Lesson 18 FACTS 82). */
export const OPEN_BEATS = 0.5

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
  /** The note a gap is measured from, in the lines: "the written note" unless given. */
  readonly whose?: string
  /**
   * The part another voice sings under the take (Lesson 26): its notes,
   * booked from bar 1's first beat; whose it is, "Merc's"; and each of its
   * notes' syllables, for the line of a note sung on one of them.
   */
  readonly other?: {
    readonly notes: readonly WrittenNote[]
    readonly whose: string
    readonly labels: readonly string[]
  }
  /** Every animation frame while the take is open. */
  readonly onFrame?: () => void
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
      /** How many notes read in the band, within 35 cents of their own note: a page's tricky line counts them. */
      readonly inBand: number
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

/** One take of written notes in time: listened for until the last window closes, then read note by note. */
export async function runTake(c: TakeContext): Promise<TakeEnd> {
  const spb = 60 / c.bpm
  // the frames' clock starts here, with the take
  const opened = performance.now()
  const o: InTimeOptions = {
    notes: c.notes,
    bpm: c.bpm,
    bar1: (c.bar1 - opened) / 1000,
    opened: 0,
    ...(c.other === undefined ? {} : { other: c.other.notes }),
  }
  const end = Math.max(...c.notes.map((n) => n.beat + n.beats))
  const frames = await c.mod.takeFrames(c.listener, {
    // with no voice at all, the take ends where an unmoved last window closes
    wait: o.bar1 + (end + WINDOW_BEATS) * spb,
    run: RUN_CAP_SEC,
    until: (fs) => (fs.at(-1)?.t ?? 0) >= windowsClose(fs, o),
    cancelled: c.cancelled,
    onFrame: () => c.onFrame?.(),
  })
  if (frames === null) return { kind: 'left' }
  const reading = readInTime(frames, o)
  if (!reading.voice)
    return { kind: 'read', voiced: false, lines: [], pitch: null, inBand: 0 }
  return {
    kind: 'read',
    voiced: true,
    lines: readingLines(c.labels, reading.notes, {
      whose: c.whose,
      other: c.other,
    }),
    pitch: pitchLineOf(frames, o, reading),
    inBand: reading.notes.filter((n) => n.d !== null && inBand(n.d)).length,
  }
}
