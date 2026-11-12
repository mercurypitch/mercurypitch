// ============================================================
// Lesson 16 Sing it's take — the voice read along the written notes
// ============================================================
//
// Loaded on the first Start, so first paint carries no reader (sing.ts).
// The take waits up to 8 s for the first voiced frame; from it, the
// cursor reader (kit/read-along.ts) lights each next note as the voice
// passes the one lit: 0.45 s held within 60 cents, folded into one
// octave, or 8 s from the note's start. The take ends as the fifth note
// passes or moves on, or at 40 s, and nothing plays while it runs
// (WEB-SPEC, Toys 6; FACTS 45, 46). Then each note is read on its own and
// given its line, its syllable first: "Re · In the band: 20 cents below
// the written note.", or "Do · We didn't hear a steady note there.", with
// no count, no score and no celebration (FACTS 47).
//
// The take's pitch line comes with its lines, for the page to draw after
// it and never during it (sing-chart.ts): each written note the take
// reached is a band over the stretch it was lit, and each frame of the
// voice is folded into the octave of the written note nearest it, so a
// learner who sings an octave lower sees their line on the bands, with the
// octave named in a tag (FACTS 46). It folds to the nearest written note,
// not the one lit: a note passes only after 0.45 s held, so a learner who
// moves on sooner sings the next note while the one before is still lit,
// and so, a fifth above do, would fold to the fourth below it.

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import type { Rung } from '@/features/lessons/kit/band-chart-rungs'
import { octavesOf } from '@/features/lessons/kit/band-words'
import type { Listener } from '@/features/lessons/kit/listen'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import type { NoteRun } from '@/features/lessons/kit/read-along'
import { readAlong, readingLines, readNotes, } from '@/features/lessons/kit/read-along'
import type { VoicedFrame } from '@/lib/mirror/metrics'
import { foldCents, median, preprocess } from '@/lib/mirror/metrics'
import type { PitchLine } from './sing-chart'

export type { PitchLine } from './sing-chart'
export { drawPitchLine } from './sing-chart'

/** The take's timing, s: the wait for the voice, and the longest take once it has begun (FACTS 45, 46). */
export const TAKE = { wait: 8, run: 40 } as const

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  /** The written notes, MIDI, in order. */
  readonly notes: readonly number[]
  /** Each note's syllable, for its line: "Do". */
  readonly labels: readonly string[]
  /** Lights the note at `i`, as the voice reaches it. */
  readonly light: (i: number) => void
  /** Abandoned: the section left or the page hidden. */
  readonly cancelled: () => boolean
}

/** How a take ended. */
export type TakeEnd =
  | { readonly kind: 'left' }
  | {
      readonly kind: 'read'
      /** A voiced frame came within the wait. */
      readonly voiced: boolean
      /** One line a note, in order. */
      readonly lines: readonly string[]
      /** The pitch line to draw after the take; null when no voice came. */
      readonly pitch: PitchLine | null
    }

/**
 * A stretch this long with no voiced frame breaks the line, s: the
 * listener's frames come about every 16 ms, so it is several missed in a
 * row, a breath or a stop, not one frame the median filter dropped.
 */
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
 * The take's pitch line over `notes` (MIDI, in order), from the reader's
 * `runs` and the take's `voiced` frames, ending at `end` on the frames'
 * clock when the last note lit never passed; null with no voice.
 */
export function pitchLineOf(
  notes: readonly number[],
  runs: readonly NoteRun[],
  voiced: readonly VoicedFrame[],
  end: number,
): PitchLine | null {
  if (runs.length === 0) return null
  const t0 = runs[0].start
  const t1 = Math.max(runs[runs.length - 1].end ?? end, t0)
  const fromDo = (midi: number): number => (midi - notes[0]) * 100
  const rungs: Rung[] = runs.map((r, i) => ({
    c: fromDo(notes[i]),
    from: r.start - t0,
    to: (r.end ?? t1) - t0,
  }))
  const line: TracePoint[] = []
  const octaves: number[] = []
  let before: number | null = null
  for (const f of voiced) {
    if (f.t < t0 || f.t > t1) continue
    if (before !== null && f.t - before > BREAK_SEC)
      line.push({ t: (before + f.t) / 2 - t0, c: null })
    const n = nearest(f.cents, notes)
    line.push({ t: f.t - t0, c: fromDo(n.midi) + n.folded })
    if (Math.abs(n.folded) <= OCTAVE_REACH)
      octaves.push(octavesOf(n.raw, n.folded))
    before = f.t
  }
  return {
    seconds: t1 - t0,
    rungs,
    line,
    octaves: octaves.length === 0 ? 0 : Math.round(median(octaves)),
  }
}

/** One take along `c.notes`: the reader lights each next note, then each note is read. */
export async function runTake(c: TakeContext): Promise<TakeEnd> {
  const along = readAlong(c.notes)
  let lit = 0
  const feed = (frames: Parameters<typeof preprocess>[0]): void => {
    const now = frames[frames.length - 1]?.t ?? 0
    const at = along.feed(preprocess(frames), now)
    if (at > lit && at < c.notes.length) {
      lit = at
      c.light(at)
    }
  }
  const frames = await c.mod.takeFrames(c.listener, {
    wait: TAKE.wait,
    run: TAKE.run,
    until: (fs) => {
      feed(fs)
      return along.done
    },
    cancelled: c.cancelled,
  })
  if (frames === null) return { kind: 'left' }
  feed(frames)
  const voiced = along.runs.length > 0
  const readings = readNotes(along, c.notes, frames)
  return {
    kind: 'read',
    voiced,
    lines: voiced ? readingLines(c.labels, readings) : [],
    pitch: pitchLineOf(
      c.notes,
      along.runs,
      preprocess(frames),
      frames[frames.length - 1]?.t ?? 0,
    ),
  }
}
