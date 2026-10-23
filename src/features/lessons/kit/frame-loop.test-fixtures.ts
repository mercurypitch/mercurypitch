// ============================================================
// Frame loop by hand — a drawer's frames, run by its own test
// ============================================================
//
// A drawer's tests ask what the page's frame loop asks of it: whether it
// has a frame to draw. `handLoop` gives a fresh copy of the loop, running
// (every kit module a test imports after it loads afresh over that copy),
// whose frames the test runs by hand on a clock it turns; timers run on the
// same clock. Each copy takes the last one's page listeners off as it
// loads, so an input a test makes wakes only its own. The browser's word on
// a figure comes from the test as well: a figure is on screen, resized,
// zoomed or its fonts loaded, and the system asks for reduced motion (on
// unless the test says otherwise), only when the test says so
// (`document.fonts.ready` stays pending: `fontsLoad` is the `loadingdone` a
// late font brings). A loop that asks for no frame has every drawer at
// rest; a canvas's paints are counted by its `fit`, which measures it once
// in every frame it draws. The test file calls `vi.useRealTimers()` and
// `vi.restoreAllMocks()` after each test.

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
  /** The page's observer reports `el` on screen (or off it, `on` false), as a scroll does. */
  see(el: Element, on?: boolean): void
  /** Every ResizeObserver watching `el` reports a new size. */
  resize(el: Element): void
  /** The screen's pixel ratio changes: a zoom, or a window moved to another screen. */
  zoom(): void
  /** The system's reduced-motion setting changes to `on`. */
  reduceMotion(on: boolean): void
  /** A web font finishes loading. */
  fontsLoad(): void
  /** How many frames `canvas` is painted in from now (its measurements, 300 by 190 px). */
  paints(canvas: HTMLCanvasElement): () => number
}

// the page listeners the last copy of the loop added, taken off before the
// next copy loads, so an input a test makes reaches only its own copy
let unlisten: (() => void)[] = []

/** Loads a fresh copy of the loop, keeping how to take off what it listens to on the page. */
async function freshCopy(): Promise<typeof FrameLoop> {
  unlisten.forEach((off) => off())
  unlisten = []
  const spies = ([document, window] as EventTarget[]).map((target) => {
    const add = target.addEventListener.bind(target)
    return vi
      .spyOn(target, 'addEventListener')
      .mockImplementation((type, fn, opts) => {
        add(type, fn, opts)
        unlisten.push(() => target.removeEventListener(type, fn, opts))
      })
  })
  const loop = await import('./frame-loop')
  spies.forEach((spy) => spy.mockRestore())
  return loop
}

interface Listening {
  readonly query: string
  readonly fn: () => void
  readonly once: boolean
}

/** A fresh, running copy of the loop, on frames the test runs by hand; reduced motion as `reduce` (default on). */
export async function handLoop(reduce = true): Promise<HandLoop> {
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

  const sizers: { report: ResizeObserverCallback; els: Set<Element> }[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly els = new Set<Element>()
      constructor(report: ResizeObserverCallback) {
        sizers.push({ report, els: this.els })
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
    },
  )

  // reduced motion on by default, as the kit's browser doubles have it; a
  // query's listeners hear the change the test makes
  let reduced = reduce
  let listening: Listening[] = []
  const fire = (match: (query: string) => boolean): void => {
    const due = listening.filter((l) => match(l.query))
    listening = listening.filter((l) => !(match(l.query) && l.once))
    due.forEach((l) => l.fn())
  }
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        get matches() {
          return query.includes('prefers-reduced-motion: reduce') && reduced
        },
        media: query,
        onchange: null,
        addEventListener: (
          _type: string,
          fn: () => void,
          opts?: AddEventListenerOptions,
        ) => {
          listening.push({ query, fn, once: opts?.once === true })
        },
        removeEventListener: (_type: string, fn: () => void) => {
          listening = listening.filter((l) => l.fn !== fn)
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )

  const fonts = new EventTarget()
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(fonts, { ready: new Promise<never>(() => undefined) }),
  })

  const loop = await freshCopy()
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
    see(el, on = true) {
      for (const s of seers.filter((x) => x.els.has(el)))
        s.report(
          [{ target: el, isIntersecting: on } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
    },
    resize(el) {
      for (const s of sizers.filter((x) => x.els.has(el)))
        s.report([], {} as ResizeObserver)
    },
    zoom() {
      fire((query) => query.includes('resolution'))
    },
    reduceMotion(on) {
      reduced = on
      fire((query) => query.includes('prefers-reduced-motion'))
    },
    fontsLoad() {
      fonts.dispatchEvent(new Event('loadingdone'))
    },
    paints(canvas) {
      const measured = vi
        .spyOn(canvas, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(0, 0, 300, 190))
      return () => measured.mock.calls.length
    },
  }
}
