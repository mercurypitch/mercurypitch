// Warming the next world while the list is read.
// ============================================================
//
// P7 (slice-5-polish-to-v1.md §2.1): what a world waits for between the
// tap on its card and its first frame, the part that needs no renderer,
// can start while the games list is on screen. That part is Merc's file
// and the pitch detector's worker (render/merc.ts, and the pitch engine's
// `preloadF0Detector`); the renderer stays per stage, as P7 decided.
//
// This module is when. Never before the list is painted: the work waits
// for the frame it was scheduled in to reach the screen -- anything
// queued from that frame's requestAnimationFrame runs after its paint --
// and then for an idle moment. Safari has no requestIdleCallback, so
// there it is a short timeout after the paint instead.
//
// A tap on a card before any of it has run loses nothing: the stage loads
// what it needs itself, exactly as it did before 5d.

export interface IdleHost {
  requestAnimationFrame(callback: FrameRequestCallback): number
  cancelAnimationFrame(handle: number): void
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(handle: number): void
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

export interface IdleTimings {
  /** The longest an idle moment is waited for before the work runs
   * anyway: a list with an animation that never lets the page idle
   * would otherwise never warm anything. */
  idleTimeoutMs: number
  /** Without requestIdleCallback, how long after the paint. Long enough
   * for the list's own first frames, short against a player reading it. */
  fallbackMs: number
}

export const WARM_TIMINGS: IdleTimings = {
  idleTimeoutMs: 2000,
  fallbackMs: 250,
}

/**
 * Run `work` once, after the frame on screen now has been painted and the
 * page is idle. Returns a cancel, safe to call at any point, twice or
 * after the work ran.
 */
export const whenIdleAfterPaint = (
  work: () => void,
  host: IdleHost = window,
  timings: IdleTimings = WARM_TIMINGS,
): (() => void) => {
  let frame: number | null = null
  let idle: number | null = null
  let timer: number | null = null
  let settled = false

  const run = (): void => {
    idle = null
    timer = null
    if (settled) return
    settled = true
    work()
  }

  frame = host.requestAnimationFrame(() => {
    frame = null
    if (settled) return
    if (typeof host.requestIdleCallback === 'function') {
      idle = host.requestIdleCallback(run, {
        timeout: timings.idleTimeoutMs,
      })
    } else {
      timer = host.setTimeout(run, timings.fallbackMs)
    }
  })

  return () => {
    settled = true
    if (frame !== null) host.cancelAnimationFrame(frame)
    if (idle !== null) host.cancelIdleCallback?.(idle)
    if (timer !== null) host.clearTimeout(timer)
    frame = null
    idle = null
    timer = null
  }
}

/**
 * Whether the games list warms anything. `?cold` in the address turns it
 * off, so a card tap's wait can be read both ways on one build and one
 * phone: the before and after that P7 asks for, off the same chip.
 */
export const isWarmEnabled = (search: string): boolean =>
  !new URLSearchParams(search).has('cold')
