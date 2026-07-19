// ============================================================
// Canvas size sync — CSS-driven canvas backing stores that actually
// track their containers
// ============================================================
//
// The rules that keep a canvas responsive:
//
//   1. CSS owns the LAYOUT size (width: 100% / flex). Never write the
//      measured size back to style.width/height — an inline pixel size
//      overrides the stylesheet, freezing the canvas at its first measure
//      and silencing every future ResizeObserver callback (the classic
//      "waveform stuck at 600px in a 1100px panel" bug).
//   2. JS owns only the BACKING store (canvas.width/height = css × dpr).
//   3. Zero-area measures (display:none, mid-mount, HMR) are skipped
//      without touching the backing store, so the last good pixels stay
//      until the element gets a real size and the observer fires again.
//
// Tests: src/tests/canvas-size-sync.test.ts
// ============================================================

export interface CanvasBackingSize {
  cssW: number
  cssH: number
  deviceW: number
  deviceH: number
}

/** Backing-store size for a measured CSS rect, or null for zero-area rects. */
export function computeBackingSize(
  rectWidth: number,
  rectHeight: number,
  dpr: number,
): CanvasBackingSize | null {
  const cssW = Math.round(rectWidth)
  const cssH = Math.round(rectHeight)
  if (cssW <= 0 || cssH <= 0) return null
  const scale = dpr > 0 ? dpr : 1
  return {
    cssW,
    cssH,
    deviceW: Math.round(cssW * scale),
    deviceH: Math.round(cssH * scale),
  }
}

/**
 * Bring one canvas's backing store in line with its CSS layout size.
 * Also removes any inline width/height a previous implementation pinned on
 * the element, so long-lived sessions self-heal back to CSS control.
 * Returns true when the backing store changed (a redraw is needed).
 */
export function syncCanvasBacking(
  canvas: HTMLCanvasElement,
  dpr: number,
): boolean {
  if (canvas.style.width !== '' || canvas.style.height !== '') {
    canvas.style.removeProperty('width')
    canvas.style.removeProperty('height')
  }
  const rect = canvas.getBoundingClientRect()
  const size = computeBackingSize(rect.width, rect.height, dpr)
  if (!size) return false
  if (canvas.width === size.deviceW && canvas.height === size.deviceH) {
    return false
  }
  canvas.width = size.deviceW
  canvas.height = size.deviceH
  return true
}

export interface RedrawScheduler {
  /** Request a redraw on the next animation frame. Calls coalesce: any
   *  number of queue()s per frame produce exactly one draw. */
  queue: () => void
  cancel: () => void
}

/** rAF-coalesced redraw scheduling — resize storms (window drags, panel
 *  resizes, observer bursts) collapse into one draw per frame. */
export function createRedrawScheduler(
  draw: () => void,
  raf: (cb: () => void) => number = (cb) => requestAnimationFrame(() => cb()),
  caf: (id: number) => void = cancelAnimationFrame,
): RedrawScheduler {
  let pending: number | null = null
  return {
    queue(): void {
      if (pending !== null) return
      pending = raf(() => {
        pending = null
        draw()
      })
    },
    cancel(): void {
      if (pending !== null) {
        caf(pending)
        pending = null
      }
    },
  }
}

export interface DprWatcher {
  dispose: () => void
}

/** Minimal window surface so tests can fake matchMedia/devicePixelRatio. */
export interface DprWatcherWindow {
  devicePixelRatio: number
  matchMedia: (query: string) => {
    addEventListener: (type: 'change', cb: () => void) => void
    removeEventListener: (type: 'change', cb: () => void) => void
  }
}

/**
 * Fire on devicePixelRatio changes (browser zoom, moving the window to a
 * monitor with a different scale). A resolution media query only matches
 * the dpr it was created for, so the listener re-arms itself with a fresh
 * query after every change.
 */
export function createDprWatcher(
  onChange: () => void,
  win: DprWatcherWindow = window,
): DprWatcher {
  let disposed = false
  let current: ReturnType<DprWatcherWindow['matchMedia']> | null = null
  let handler: (() => void) | null = null

  const arm = (): void => {
    if (disposed) return
    current = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`)
    handler = () => {
      current?.removeEventListener('change', handler!)
      onChange()
      arm()
    }
    current.addEventListener('change', handler)
  }
  arm()

  return {
    dispose(): void {
      disposed = true
      if (current && handler) {
        current.removeEventListener('change', handler)
      }
      current = null
      handler = null
    },
  }
}
