// ============================================================
// Lesson sound run recorder — every run a page starts, ended by the test
// ============================================================
//
// A page test that drives a lesson's toys swaps the kit's runs (kit/run.ts)
// for these recorders, so it sees each sound the page asks for (a sung line,
// a tune or one note), with its notes and options, and decides how it ends:
// heard to its end (`end(true)`), or left for the page to stop. Nothing is
// timed and nothing sounds. `onNote` fires only when the test says a note
// starts (`note(i)`), so a figure that draws as a note sounds can be checked
// note by note. `allOf` stays the kit's own: it joins any runs. Lesson 8's
// beat clock has its own recorder (lesson-08/page-dom.test-fixtures.ts);
// these serve the pages on kit/run.ts, Lessons 9, 10 and 12 among them.
//
// The test file names the swap itself, since a mock is the test file's own:
//
//   import type * as RunModule from '@/features/lessons/kit/run'
//
//   vi.mock('@/features/lessons/kit/run', async (actual) => ({
//     ...(await actual<typeof RunModule>()),
//     ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
//       .recordedRuns,
//   }))
//
// Only types come from kit/run.ts, so the swap's factory can load this file
// before the module it replaces.

import type { Run, RunNote, RunOptions } from './run'
import type { ContourPoint } from './sound'

/** Which of the kit's runs the page asked for. */
export type RunKind = 'line' | 'notes' | 'note'

type NotesOptions = RunOptions & {
  readonly onNote?: (n: RunNote, i: number) => void
}

/** A run the page started: what it asked for, whether it was stopped, and the test's controls. */
export interface RecordedRun {
  readonly kind: RunKind
  /** A tune's notes, or one note's; empty for a sung line. */
  readonly notes: readonly RunNote[]
  /** A sung line's contour; empty for a tune or a note. */
  readonly points: readonly ContourPoint[]
  readonly o: NotesOptions
  /** True once the page stopped it, or the test ended it unheard. */
  stopped: boolean
  /** True once it has ended either way. */
  over: boolean
  /** Ends it as the kit's run does: heard to its end (true), or cut short (false). */
  end(heard: boolean): void
  /** Starts note `i`, as the kit's timer would: the page's `onNote` hears it. */
  note(i: number): void
}

/** Every run started since the last `resetRuns`, in order. */
export const runs: RecordedRun[] = []

export const resetRuns = (): void => {
  runs.length = 0
}

/** The runs still going. */
export const live = (): RecordedRun[] => runs.filter((r) => !r.over)

function record(
  kind: RunKind,
  notes: readonly RunNote[],
  points: readonly ContourPoint[],
  o: NotesOptions,
): Run {
  let settle: (heard: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const run: RecordedRun = {
    kind,
    notes,
    points,
    o,
    stopped: false,
    over: false,
    end(heard) {
      if (run.over) return
      run.over = true
      if (!heard) run.stopped = true
      settle(heard)
    },
    note(i) {
      const n = notes[i]
      if (n === undefined) throw new Error(`the run has no note ${i}`)
      o.onNote?.(n, i)
    },
  }
  runs.push(run)
  return {
    done,
    stop() {
      run.end(false)
    },
  }
}

/** The kit's three runs, as recorders: spread over kit/run.ts in a `vi.mock`. */
export const recordedRuns = {
  playLine: (points: readonly ContourPoint[], o: RunOptions): Run =>
    record('line', [], points, o),
  playNotes: (notes: readonly RunNote[], o: NotesOptions): Run =>
    record('notes', notes, [], o),
  playNote: (midi: number, seconds: number, o: RunOptions): Run =>
    record('note', [{ t: 0, midi, dur: seconds }], [], o),
}
