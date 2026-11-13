// ============================================================
// Beat clock recorder — every run a page starts on the beat clock, driven by the test
// ============================================================
//
// A page test that plays a rhythm on the kit's beat clock (kit/beat-clock.ts)
// makes the clock this recorder (`FakeBeatClock`): nothing is timed and
// nothing sounds, each run the page starts is kept with its options, and
// the test drives the last run on beat by beat as the clock would
// (`drive`), each hit booked and heard, then ends it heard (`finish`) or
// leaves it for the page to stop. Lessons 17 and 19 drive their rhythm
// bars and takes with it; Lesson 8's beat machine keeps its own
// (lesson-08/page-dom.test-fixtures.ts). The test file names the swap
// itself, since a mock is the test file's own; this module imports only
// the clock's types, so the swap can load it first:
//
//   import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
//
//   vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
//     ...(await actual<typeof BeatClockModule>()),
//     BeatClock: (
//       await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
//     ).FakeBeatClock,
//   }))

import type { Run, RunOptions } from './beat-clock'

/** Lets the promises the page awaits settle. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

/** A run the page asked the clock for: its options, whether it was stopped, and a way to end it. */
export interface FakeRun {
  readonly o: RunOptions<unknown>
  stopped: boolean
  /** Ends the run as the clock does: heard to its end (true), or silenced (false). */
  end(heard: boolean): void
}

/** Every run started since the last `resetRuns`, in order. */
export const runs: FakeRun[] = []

export const resetRuns = (): void => {
  runs.length = 0
}

/** The kit's beat clock, as a recorder: nothing is booked or heard until `drive`. */
export const FakeBeatClock = {
  start<T>(o: RunOptions<T>): Run {
    let ended: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => (ended = r))
    let over = false
    const run: FakeRun = {
      o: o as RunOptions<unknown>,
      stopped: false,
      end(heard) {
        if (over) return
        over = true
        if (!heard) run.stopped = true
        ended(heard)
      },
    }
    runs.push(run)
    return {
      done,
      get running() {
        return !over
      },
      stop() {
        run.end(false)
      },
      pageTimeOfBeat: (n: number) => n * 1000,
      audioTimeOfBeat: (n: number) => n,
    }
  },
}

const cursors = new WeakMap<FakeRun, { i: number; b: number; beats: number }>()

/**
 * Drives the last run on from where it was, as the clock would: beat by
 * beat it books each hit and shows it as heard, for `count` beats (to the
 * end by default).
 */
export function drive(count = Infinity): void {
  const run = runs[runs.length - 1]
  const at = cursors.get(run) ?? { i: 0, b: 0, beats: 0 }
  for (let n = 0; n < count && !run.stopped; ) {
    const bar = run.o.bar(at.i)
    if (bar === null) break
    if (at.b >= bar.beats) {
      at.i += 1
      at.b = 0
      continue
    }
    run.o.bpm()
    run.o.onBeat?.({ bar: at.i, beat: at.b, beats: at.beats })
    const b = at.b
    const due = bar.hits.filter((h) =>
      b === 0 ? h.beat < 1 : Math.floor(h.beat) === b,
    )
    for (const h of due) {
      run.o.book?.(h.data, 0, {} as never)
      run.o.onHit?.(h.data, {
        bar: at.i,
        beat: b,
        beats: at.beats + h.beat - b,
      })
    }
    at.b += 1
    at.beats += 1
    n += 1
  }
  cursors.set(run, at)
}

/** Drives the last run to its end and ends it, heard, as the clock does. */
export async function finish(): Promise<void> {
  drive()
  runs[runs.length - 1].end(true)
  await settle()
}
