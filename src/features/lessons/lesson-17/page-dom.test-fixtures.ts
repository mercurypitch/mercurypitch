// ============================================================
// Lesson 17 page doubles — the page's own markup, sound on, and its parts
// ============================================================
//
// A test that drives Lesson 17's modules as the page does loads
// learn/17.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser. Sound is on, as after a first tap, with
// `soundOn`. The page's scripts never run: the test mounts what it drives.
//
// Every rhythm the page plays goes through the kit's beat clock, so a test
// that plays one makes the clock a recorder (`FakeBeatClock`) and drives
// the last run on beat by beat as the clock would (`drive`), each hit
// booked and heard, then ends it (`finish`). The test file names the swap
// itself, since a mock is the test file's own, and this module imports
// nothing that loads the clock, so the swap can import it:
//
//   vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
//     ...(await actual<typeof import('@/features/lessons/kit/beat-clock')>()),
//     BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
//   }))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { Run, RunOptions } from '@/features/lessons/kit/beat-clock'
import { Sound } from '@/features/lessons/kit/sound'

/** learn/17.html, as the repository has it. */
export const PAGE = readFileSync(
  resolve(process.cwd(), 'learn/17.html'),
  'utf8',
)

/** learn/17.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/17.html has no body')
  document.body.innerHTML = body[1]
  document.body.className = 'season-2'
}

/** Sound on, as after the first tap. */
export function soundOn(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends Element = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** An element's words, as a reader meets them. */
export const words = (e: Element | null | undefined): string =>
  (e?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Lets the promises the page awaits settle. */
export const settle = async (): Promise<void> => {
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
