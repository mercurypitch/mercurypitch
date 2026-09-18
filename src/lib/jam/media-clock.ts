// ============================================================
// Following a media element's clock at the rate a picture moves
// ============================================================
//
// `timeupdate` fires about four times a second. That is fine for a counter
// and wrong for anything drawn: in a Jam room the lane notes were positioned
// from it while the live pitch trail beside them ran off its own per-frame
// clock, so the notes stepped in quarter-second jumps past a trail that
// glided. Two clocks at two rates in one picture read as the lane being out
// of time with the singing, which is what it was reported as.
//
// The element stays the only source of truth; this just samples it per frame
// while it is playing. `timeupdate` is kept, and matters more than it looks:
// animation frames stop in a hidden tab, and a phone with the room in the
// background must still advance the song.

/** Injectable so a test can step frames without a real display. */
export interface FrameScheduler {
  request(callback: () => void): number
  cancel(handle: number): void
}

/**
 * The part of a media element this needs. Spelled out rather than picked off
 * `HTMLMediaElement`, whose `addEventListener` overloads accept handler
 * objects no fake in a test can satisfy; a real element still fits this.
 */
interface MediaClock {
  readonly currentTime: number
  readonly paused: boolean
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(() => callback()),
  cancel: (handle) => cancelAnimationFrame(handle),
}

/**
 * Report `element.currentTime` every frame while it plays, and on every
 * `timeupdate` besides. Returns the teardown.
 */
export function followMediaClock(
  element: MediaClock,
  report: (seconds: number) => void,
  frames: FrameScheduler = browserFrames,
): () => void {
  let handle: number | null = null
  const tick = (): void => {
    report(element.currentTime)
    handle = frames.request(tick)
  }
  const start = (): void => {
    if (handle === null) handle = frames.request(tick)
  }
  const stop = (): void => {
    if (handle !== null) frames.cancel(handle)
    handle = null
  }
  // A pause or an ending leaves the position where it stopped, not one frame
  // short of it.
  const settle = (): void => {
    stop()
    report(element.currentTime)
  }
  const onTimeUpdate = (): void => report(element.currentTime)
  element.addEventListener('timeupdate', onTimeUpdate)
  element.addEventListener('playing', start)
  element.addEventListener('pause', settle)
  element.addEventListener('ended', settle)
  if (!element.paused) start()
  return () => {
    stop()
    element.removeEventListener('timeupdate', onTimeUpdate)
    element.removeEventListener('playing', start)
    element.removeEventListener('pause', settle)
    element.removeEventListener('ended', settle)
  }
}
