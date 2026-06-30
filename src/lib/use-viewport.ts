// ============================================================
// use-viewport — single reactive source of truth for "is this a small / touch
// screen?". Replaces the scattered, non-reactive checks (prefersTopDock,
// GuitarPage's isSmallScreen, Walkthrough's isMobile) that each re-implemented
// the same matchMedia query and never updated on resize / rotation.
//
// `isMobile()` is an app-lifetime accessor backed by a single matchMedia
// listener, so every caller shares one signal and reacts to viewport changes.
// ============================================================

import { createSignal } from 'solid-js'

/**
 * Breakpoints used across the app (px). `mobile` is the de-facto cutoff where
 * the sidebar goes off-canvas and the layout switches to a single column.
 */
export const BREAKPOINTS = {
  mobile: 768,
  small: 600,
  tiny: 480,
} as const

// "Small screen OR touch device" — for interaction defaults (dock side, hiding
// touch-only chrome). Matches the existing de-facto prefersTopDock query.
const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile}px), (pointer: coarse)`
// Width-only — for layout decisions that hinge on the breakpoint itself, e.g.
// "is the sidebar an off-canvas drawer right now?" (its CSS is max-width:768).
const NARROW_QUERY = `(max-width: ${BREAKPOINTS.mobile}px)`

function createReactiveMatch(query: string): () => boolean {
  // SSR / non-DOM guard — behave as desktop when there's no matchMedia.
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    const [val] = createSignal(false)
    return val
  }
  const mql = window.matchMedia(query)
  const [matches, setMatches] = createSignal(mql.matches)
  const onChange = (): void => {
    setMatches(mql.matches)
  }
  // App-lifetime listener: this module-level signal is never disposed, so no
  // onCleanup is needed (and it must not depend on a component owner).
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange)
  } else {
    // Older WebKit: addListener is the only API.
    ;(
      mql as MediaQueryList & { addListener: (cb: () => void) => void }
    ).addListener(onChange)
  }
  return matches
}

/** Reactive: true on small (<=768px) or touch screens. App-lifetime singleton. */
export const isMobile: () => boolean = createReactiveMatch(MOBILE_QUERY)

/**
 * Reactive: true when the viewport is narrow (<=768px), regardless of input
 * type. Use for layout decisions tied to the breakpoint (e.g. the off-canvas
 * sidebar drawer); use `isMobile` for touch-aware interaction defaults.
 */
export const isNarrow: () => boolean = createReactiveMatch(NARROW_QUERY)

/** Hook-style alias for ergonomics in components. */
export function useIsMobile(): () => boolean {
  return isMobile
}
