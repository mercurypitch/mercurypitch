// ============================================================
// Lesson browser doubles — what jsdom lacks, for the kit's own tests
// ============================================================
//
// The kit reads the motion setting and starts an IntersectionObserver as
// its modules load, and every toy draws on a 2D canvas: jsdom has none of
// the three. A test imports this module for its side effect (`import
// './browser-doubles.test-fixtures'`), and the import sort puts a bare
// import ahead of every relative one, so the doubles are in place before
// any kit module runs. Reduced motion is on, so nothing animates and every
// change lands at once; the observer reports only when a test scrolls an
// element out of view or back into it (`scrollOutOfView`,
// `scrollIntoViewAgain`), so no drawer is active until a test brings its
// element into view, and one unobserved or disconnected hears nothing; the
// context takes every call and draws nothing.

import { vi } from 'vitest'

function mediaQuery(query: string): MediaQueryList {
  return {
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }
}

/**
 * Each element's observers, as a test may report it out of view or back in
 * view to them: one map on the global, as a page's modules loaded afresh
 * (`vi.resetModules`) load this module afresh too, and its observers are the
 * fresh copy's.
 */
const WATCHERS = Symbol.for('lessons.browser-doubles.watchers')
const shared = globalThis as { [WATCHERS]?: WeakMap<Element, QuietObserver[]> }
const watchers = (shared[WATCHERS] ??= new WeakMap())

class QuietObserver {
  private readonly report: IntersectionObserverCallback
  /** What it observes, so that disconnecting takes it off each one's list. */
  private readonly targets = new Set<Element>()
  constructor(report: IntersectionObserverCallback) {
    this.report = report
  }
  observe(target: Element): void {
    this.targets.add(target)
    watchers.set(target, [...(watchers.get(target) ?? []), this])
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
    const left = (watchers.get(target) ?? []).filter((o) => o !== this)
    watchers.set(target, left)
  }
  disconnect(): void {
    for (const target of [...this.targets]) this.unobserve(target)
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  /** One report on `target`, an entry for each of `seen` in turn: in view, or out of it. */
  tell(target: Element, seen: readonly boolean[]): void {
    const entries = seen.map((on) => ({
      target,
      isIntersecting: on,
      intersectionRatio: on ? 1 : 0,
    }))
    this.report(
      entries as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    )
  }
}

/** `target` off screen, as scrolling it out of view reports to whatever observes it. */
export function scrollOutOfView(target: Element): void {
  for (const o of watchers.get(target) ?? []) o.tell(target, [false])
}

/** `target` on screen again, as scrolling it back into view reports to whatever observes it. */
export function scrollIntoViewAgain(target: Element): void {
  for (const o of watchers.get(target) ?? []) o.tell(target, [true])
}

/** `target` scrolled away and back between two reports: one report, its out entry first. */
export function scrollAwayAndBack(target: Element): void {
  for (const o of watchers.get(target) ?? []) o.tell(target, [false, true])
}

/** The few context calls whose result a caller reads; every other call returns nothing. */
const RESULTS: Readonly<Record<string, () => unknown>> = {
  measureText: () => ({ width: 0 }),
  createLinearGradient: () => ({ addColorStop: () => undefined }),
  createRadialGradient: () => ({ addColorStop: () => undefined }),
}

function blankContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const props: Record<PropertyKey, unknown> = { canvas }
  return new Proxy(props, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (RESULTS[String(key)] ?? ((): undefined => undefined)),
    set: (target, key, value: unknown) => {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

vi.stubGlobal('matchMedia', mediaQuery)
vi.stubGlobal('IntersectionObserver', QuietObserver)
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return blankContext(this)
} as unknown as HTMLCanvasElement['getContext']
