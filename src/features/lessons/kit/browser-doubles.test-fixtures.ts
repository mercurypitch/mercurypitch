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
// change lands at once; the observer never reports, so no drawer is ever
// active; the context takes every call and draws nothing.

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

class QuietObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
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
