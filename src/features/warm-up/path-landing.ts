// ============================================================
// The Warm-up's path as the native onboarding's landing (S7b beat 10)
// ============================================================
//
// The onboarding ends on the path (apps/mercurypitch onboarding-layer.ts):
// it asks for the landing, then pushes the path over the Sing room. The
// path takes the ask as it mounts, once: it draws in as on the day's first
// open (path-motion.ts), even on a later open that day, and Merc hops from
// the floor beside the first stop once it is in. Every other open is the
// path's own.

let asked = false

/** The next path to open is the onboarding's landing. */
export function askPathLanding(): void {
  asked = true
}

/** Whether this open is the landing: true once per ask. */
export function takePathLanding(): boolean {
  const landing = asked
  asked = false
  return landing
}

export function resetPathLandingForTests(): void {
  asked = false
}
