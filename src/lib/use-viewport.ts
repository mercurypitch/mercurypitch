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

/**
 * The tallest a touch screen held sideways can be and still count as a phone
 * (CSS px). Phones on their side are 360 to about 450 px tall (Pixel 8 Pro:
 * 448, iPhone Pro Max: 430, before the browser's own bars take their share);
 * the smallest tablets are about 520 even with Chrome's bars (an 8-inch
 * Android, 962x601). 500 sits between them, and it is the height the hosted
 * Karaoke stage already calls short (KaraokeMobileStage.module.css).
 */
export const SHORT_LANDSCAPE_MAX_HEIGHT = 500

// "Small screen OR touch device" — for interaction defaults (dock side, hiding
// touch-only chrome). Matches the existing de-facto prefersTopDock query.
const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile}px), (pointer: coarse)`
// Width-only — for layout decisions that hinge on the breakpoint itself, e.g.
// "is the sidebar an off-canvas drawer right now?" (its CSS is max-width:768).
const NARROW_QUERY = `(max-width: ${BREAKPOINTS.mobile}px)`
// A phone on its side: wider than the breakpoint, so not narrow, and short.
// The pointer keeps a short desktop window, and a touch laptop's mouse, out.
const SHORT_TOUCH_LANDSCAPE_QUERY = `(pointer: coarse) and (orientation: landscape) and (max-height: ${SHORT_LANDSCAPE_MAX_HEIGHT}px)`

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

/**
 * Reactive: a touch screen held sideways that is too short for a desktop
 * layout — a phone on its side (844x390, 780x360). Not narrow, so width-only
 * checks miss it. Tablets and touch laptops at their normal heights do not
 * count; see SHORT_LANDSCAPE_MAX_HEIGHT.
 */
export const isShortTouchLandscape: () => boolean = createReactiveMatch(
  SHORT_TOUCH_LANDSCAPE_QUERY,
)

/** Hook-style alias for ergonomics in components. */
export function useIsMobile(): () => boolean {
  return isMobile
}
