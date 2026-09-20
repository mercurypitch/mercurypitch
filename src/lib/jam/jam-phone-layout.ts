// ── jamPhoneLayout ────────────────────────────────────────────────────
// Is the jam room in its phone layout right now?
//
// The room's stylesheets switch at 640px, and almost everything that
// switches is CSS. This is for the few things that have two HOMES rather
// than two looks -- a control that lives in one row on a phone and in
// another on anything wider. Those must be mounted once, in one place:
// two copies with one hidden is two fetches and two sets of buttons for
// anything that finds one by name.
//
// Not `isNarrow()` from use-viewport: that is 768px, the sidebar's
// breakpoint, and between the two a JS answer would disagree with the
// stylesheet about which layout is on screen.

import { createSignal } from 'solid-js'

/** The same number the jam stylesheets' phone blocks use. */
export const JAM_PHONE_QUERY = '(max-width: 640px)'

let matches: (() => boolean) | undefined

function watch(): () => boolean {
  // jsdom and SSR have no matchMedia: behave as a desk.
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => false
  }
  const mql = window.matchMedia(JAM_PHONE_QUERY)
  const [value, setValue] = createSignal(mql.matches)
  const onChange = (): void => {
    setValue(mql.matches)
  }
  // App-lifetime, like use-viewport's: one listener, never disposed.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange)
  } else {
    // Older WebKit: addListener is the only API.
    ;(
      mql as MediaQueryList & { addListener: (cb: () => void) => void }
    ).addListener(onChange)
  }
  return value
}

/** Reactive. Made on first use, so importing this costs a test nothing. */
export function jamPhoneLayout(): boolean {
  matches ??= watch()
  return matches()
}
