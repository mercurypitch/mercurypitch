// ============================================================
// Frame loop — a requestAnimationFrame loop that runs only while it has work
// ============================================================
//
// The app keeps some controllers for the whole session (the singing frame
// stream, the piano game), and each used to ask for a frame forever, with
// the Studio or any other tab on screen. This loop asks for frames while
// `active()` is true, runs one more frame after it turns false so the last
// state gets drawn, and asks again on the next frame once `active()` turns
// true.
//
// `active` is read reactively: build it from signals, or nothing wakes the
// loop. A frame that changes what `active` reads leaves one loop running,
// never two. Lesson pages have their own page-wide loop for canvases
// (features/lessons/kit/frame-loop.ts).
import type { Accessor } from 'solid-js'
import { createEffect, onCleanup, untrack } from 'solid-js'

export interface FrameLoopOptions {
  /** True while the loop has work; a reactive read. */
  readonly active: Accessor<boolean>
  /** One frame of that work. */
  readonly frame: (now: number) => void
  /** For tests; the browser's requestAnimationFrame otherwise. */
  readonly requestFrame?: (callback: FrameRequestCallback) => number
  readonly cancelFrame?: (id: number) => void
}

/** Run `frame` every display frame while `active()`; stops with its owner. */
export function createFrameLoop(options: FrameLoopOptions): void {
  const requestFrame =
    options.requestFrame ?? ((callback) => requestAnimationFrame(callback))
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id))
  let pending: number | null = null
  let disposed = false

  const tick = (now: number): void => {
    pending = null
    if (disposed) return
    options.frame(now)
    // A frame may have woken the loop itself, through the effect below.
    if (!disposed && pending === null && untrack(options.active)) {
      pending = requestFrame(tick)
    }
  }

  createEffect(() => {
    if (options.active() && pending === null && !disposed) {
      pending = requestFrame(tick)
    }
  })

  onCleanup(() => {
    disposed = true
    if (pending !== null) cancelFrame(pending)
    pending = null
  })
}
