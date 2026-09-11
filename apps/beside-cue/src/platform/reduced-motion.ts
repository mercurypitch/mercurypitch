import { createSignal, onCleanup } from 'solid-js'

// ============================================================
// Reduced motion -- the viewer's `prefers-reduced-motion`, live
// ============================================================
//
// One reading of the preference for the whole app. AssetStage kept its
// own copy, and the 3D worlds needed the same thing (slice 5c, P6), so it
// lives here rather than twice. A signal, and a live one: the setting can
// change while a screen is open, and what is on screen should follow it
// rather than wait for a remount.
//
// Call it inside a component or another reactive owner: the listener is
// removed with that owner.

export function createReducedMotion(): () => boolean {
  if (typeof window === 'undefined' || window.matchMedia === undefined) {
    return () => false
  }
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  const [reduced, setReduced] = createSignal(query.matches)
  const listener = (event: MediaQueryListEvent): void => {
    setReduced(event.matches)
  }
  query.addEventListener('change', listener)
  onCleanup(() => {
    query.removeEventListener('change', listener)
  })
  return reduced
}
