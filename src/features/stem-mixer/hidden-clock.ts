// ============================================================
// The song's clock while the page is hidden
// ============================================================
//
// The mixer's frame loop is the song's clock for everything it draws, and it
// is also what notices the song's end. A hidden page gets no frames, so a
// song the native app keeps playing behind another app would run out and
// leave the transport playing silence: no end, no next song, and on Android
// a media notification that never goes away. While the page is hidden this
// ticks instead, about once a second, which is as often as a hidden page's
// timers run anyway. The frame loop takes over again on the way back.

/** How often the hidden clock ticks. */
export const HIDDEN_TICK_MS = 1000

/**
 * Calls `tick` every `intervalMs` while the page is hidden and `active()`
 * holds, and never while the page is visible. Returns the stop.
 */
export function createHiddenClock(
  active: () => boolean,
  tick: () => void,
  intervalMs: number = HIDDEN_TICK_MS,
): () => void {
  if (typeof document === 'undefined') return () => undefined

  let timer: ReturnType<typeof setInterval> | undefined
  const stopTimer = (): void => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }
  const follow = (): void => {
    if (document.visibilityState !== 'hidden') {
      stopTimer()
      return
    }
    timer ??= setInterval(() => {
      if (active()) tick()
    }, intervalMs)
  }

  document.addEventListener('visibilitychange', follow)
  follow()
  return () => {
    document.removeEventListener('visibilitychange', follow)
    stopTimer()
  }
}
