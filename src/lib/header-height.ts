// ============================================================
// header-height — publish the app header's height as --app-header-h
// ============================================================
//
// Anything pinned to the top-right corner has to clear the header, and the
// header has no height to hard-code: it is content-sized on a desktop and
// wraps to two rows on a phone, so the number changes with the viewport, the
// font setting and whichever contextual pill the current tab puts in it.
//
// Measuring it once at mount would be wrong by the first resize, so this
// observes it. The variable lands on <html>, where any fixed-position layer
// can read it — today the toast stack (src/styles/Notifications.module.css).
// Consumers must supply a `0px` fallback: the standalone karaoke and mirror
// entries mount without an app header, and nothing ever calls this there.

/**
 * Keep `--app-header-h` on `<html>` in step with the header's rendered height.
 *
 * `ResizeObserver` is the primary signal but not the only one, because its
 * delivery is part of the rendering lifecycle and stops with it: a page that
 * is not compositing (background tab, offscreen preview) queues no callbacks
 * at all, and the variable would still read whatever it did when the tab was
 * last visible. `resize` covers the case that actually moves this number, and
 * a visibility change re-measures on the way back. See
 * docs/agent/MISTAKES.md — this is the same suspension that broke the nav's
 * fit pass.
 *
 * Returns a teardown function. Safe to call with no element — it does nothing
 * rather than pinning the variable at 0 and fighting a later caller.
 */
export function publishHeaderHeight(
  header: HTMLElement | undefined | null,
): () => void {
  if (header === undefined || header === null) return () => {}
  const root = document.documentElement

  const write = (): void => {
    // Re-resolved every time rather than closed over: the header renders
    // inside a <Show>, so the node this was handed can be replaced by an
    // identical one, and an observer left on the detached original would
    // freeze the variable at its last live measurement.
    const live = document.querySelector('header') ?? header
    // Fractional heights are the norm here; rounding up by a whole pixel is
    // cheaper than a half-pixel overlap that only shows on one zoom level.
    const h = Math.ceil(live.getBoundingClientRect().height)
    // A detached or not-yet-laid-out header measures 0, which would drop the
    // toast stack back onto the buttons. Keep the last good value instead.
    if (h > 0) root.style.setProperty('--app-header-h', `${h}px`)
  }

  write()

  const onVisible = (): void => {
    if (document.visibilityState === 'visible') write()
  }
  window.addEventListener('resize', write)
  document.addEventListener('visibilitychange', onVisible)

  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write)
  observer?.observe(header)

  return () => {
    observer?.disconnect()
    window.removeEventListener('resize', write)
    document.removeEventListener('visibilitychange', onVisible)
    root.style.removeProperty('--app-header-h')
  }
}
