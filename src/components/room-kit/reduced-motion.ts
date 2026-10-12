// ============================================================
// Reduced motion: the one reading a premium room takes
// ============================================================
//
// The app reads the phone's own setting, `prefers-reduced-motion`, where
// it is asked (no setting of its own). Long note asks in three places:
// Merc's moves (no drop, hop or jumping cheer), the layout's glide and the
// demo's pulses.

/** The singer's phone asks for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
