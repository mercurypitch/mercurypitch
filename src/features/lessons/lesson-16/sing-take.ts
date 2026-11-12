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

import type { Listener } from '@/features/lessons/kit/listen'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { readAlong, readingLines, readNotes, } from '@/features/lessons/kit/read-along'
import { preprocess } from '@/lib/mirror/metrics'

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
  }
}
