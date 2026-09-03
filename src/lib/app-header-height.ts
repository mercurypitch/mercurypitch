// ── Publish the app header's height as a CSS variable ────────────────
//
// Toasts on a phone need to start below the header, and the header is not a
// fixed height: one row (50px) on most screens, two (92px) once the icon-tab
// strip is showing, and taller again when the voice pill docks into it. Both
// constants are wrong — 50px puts a toast over the tab row, 92px opens a gap
// under a one-row header — and CSS cannot measure an element.
//
// So the header measures itself here and writes `--app-header-height`, which
// Notifications.module.css reads. Anything else that needs to clear the header
// can read the same value rather than guessing again.
//
// The variable is REMOVED rather than set to 0 when there is no header to
// measure, so every consumer's own fallback applies — a surface with no header
// (the standalone karaoke and mirror entries) then keeps the placement it had
// before this existed.

const VAR = '--app-header-height'

/**
 * Keep `--app-header-height` in step with `header`, until the returned
 * function is called.
 *
 * Safe to call where `ResizeObserver` does not exist (jsdom without a polyfill,
 * very old browsers): the height is published once and simply stops tracking,
 * which is still better than a constant.
 */
export function trackAppHeaderHeight(header: HTMLElement): () => void {
  const root = document.documentElement

  const publish = (): void => {
    // offsetHeight rather than getBoundingClientRect: a transformed header —
    // a page transition mid-flight — would otherwise report its scaled height
    // and park the toast at whatever fraction the animation happened to be on.
    const h = header.offsetHeight
    if (h > 0) root.style.setProperty(VAR, `${h}px`)
    else root.style.removeProperty(VAR)
  }

  publish()

  if (typeof ResizeObserver !== 'function') {
    return () => root.style.removeProperty(VAR)
  }

  const observer = new ResizeObserver(publish)
  observer.observe(header)

  return () => {
    observer.disconnect()
    root.style.removeProperty(VAR)
  }
}
