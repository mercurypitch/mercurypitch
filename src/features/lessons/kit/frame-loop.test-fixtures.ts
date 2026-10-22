// ============================================================
// Frame loop by hand — a drawer's frames, run by its own test
// ============================================================
//
// A drawer's tests ask what the page's frame loop asks of it: whether it
// has a frame to draw. `handLoop` gives a fresh copy of the loop, running
// (every kit module a test imports after it loads afresh over that copy),
// whose frames the test runs by hand on a clock it turns; timers run on the
// same clock. The browser's word on a figure comes from the test as well: a
// figure is on screen only when the test says so. A loop that asks for no
// frame has every drawer at rest. The test file calls `vi.useRealTimers()`
// and `vi.restoreAllMocks()` after each test.

import { vi } from 'vitest'
import type * as FrameLoop from './frame-loop'

export interface HandLoop {
  readonly loop: typeof FrameLoop
  /** The frames the page has asked for and the test has not yet run. */
  readonly asked: FrameRequestCallback[]
  /** Turns the clock 16 ms and runs every frame asked for, as one; false when none was. */
  frame(): boolean
  /** Runs frames until the page asks for none, at most `max`; how many ran. */
  settle(max?: number): number
  /** The page's observer reports `el` on screen, as a scroll that brings it in does. */
  see(el: Element): void
}

/** A fresh, running copy of the loop, on frames the test runs by hand. */
export async function handLoop(): Promise<HandLoop> {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  const asked: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) =>
    asked.push(cb),
  )

  const seers: { report: IntersectionObserverCallback; els: Set<Element> }[] =
    []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly els = new Set<Element>()
      constructor(report: IntersectionObserverCallback) {
        seers.push({ report, els: this.els })
      }
      observe(el: Element): void {
        this.els.add(el)
      }
      unobserve(el: Element): void {
        this.els.delete(el)
      }
      disconnect(): void {
        this.els.clear()
      }
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    },
  )

  const loop = await import('./frame-loop')
  loop.startFrameLoop()
  const frame = (): boolean => {
    if (asked.length === 0) return false
    const due = asked.splice(0)
    vi.advanceTimersByTime(16)
    const now = performance.now()
    due.forEach((cb) => cb(now))
    return true
  }
  return {
    loop,
    asked,
    frame,
    settle(max = 2000) {
      let ran = 0
      while (ran < max && frame()) ran += 1
      return ran
    },
    see(el) {
      for (const s of seers.filter((x) => x.els.has(el)))
        s.report(
          [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
    },
  }
}
