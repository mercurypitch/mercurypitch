// ============================================================
// Lesson 8 page doubles — the page's own markup, and every run it starts
// ============================================================
//
// A test that drives Lesson 8's modules as the page does loads
// learn/08.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser. Every sound on the page goes through the
// beat clock, so a test swaps the kit's clock for `FakeBeatClock`, which
// records each run it is asked for and lets the test end it as heard
// (`runs[i].end(true)`) or leave it to be stopped. The test file names the
// swap itself, since a mock is the test file's own:
//
//   vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
//     ...(await actual<typeof import('@/features/lessons/kit/beat-clock')>()),
//     BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
//   }))
//
// Sound is on, as after a first tap (`soundOn`). The page's scripts never
// run: the test mounts what it drives, the steps on the page's own deck
// (`mountSteps`) as main.ts mounts them.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { Run, RunOptions } from '@/features/lessons/kit/beat-clock'
import { Sound } from '@/features/lessons/kit/sound'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/08.html'), 'utf8')

/** learn/08.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/08.html has no body')
  document.body.innerHTML = body[1]
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

/** The runs still going. */
export const live = (): FakeRun[] => runs.filter((r) => !r.stopped)

/** The kit's beat clock, as a recorder: nothing is booked or drawn. */
export const FakeBeatClock = {
  start<T>(o: RunOptions<T>): Run {
    let settle: (heard: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => (settle = r))
    let over = false
    const run: FakeRun = {
      o: o as RunOptions<unknown>,
      stopped: false,
      end(heard) {
        if (over) return
        over = true
        if (!heard) run.stopped = true
        settle(heard)
      },
    }
    runs.push(run)
    return {
      done,
      get running() {
        return !over
      },
      stop() {
        run.stopped = true
        run.end(false)
      },
      pageTimeOfBeat: (n: number) => n * 1000,
    }
  },
}

/** Sound on, as after the first tap. */
export function soundOn(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** Lets the promises the page awaits settle. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** A figure with a size, so the beat machine lays itself out as in a browser. */
export function sizeFigures(): void {
  for (const f of document.querySelectorAll<HTMLElement>('[data-bm]')) {
    Object.defineProperty(f, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(f, 'clientHeight', { value: 250, configurable: true })
  }
}

/** jsdom has no ResizeObserver; the beat machine only asks it for a new layout. */
export function quietResizes(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
}
