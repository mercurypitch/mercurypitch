// ============================================================
// The app leaving a premium room while the page still shows
// ============================================================
//
// A room hears the singer go from its page (`visibilitychange`). The app
// can go with the page still showing: Control Center and the notification
// shade on iOS send `willResignActive` and nothing more, so the page never
// hides. The shell parks the audio clock on that word (native-shell.ts),
// and the clock asks every lease first (`prepareToSuspend`,
// packages/audio-io). A room's lease answers by announcing it here, and the
// room and its demo end as they do when the page hides: the same line, and
// nothing kept (owner, 16 Oct 2026: a take or demo ends when Control Center
// comes down). The clock asks before every park, the page's own included,
// so each listener must be safe to call twice.

const listeners = new Set<() => void>()

/** Calls `listener` each time the app parks a room's clock. Returns the unsubscribe. */
export function onAppLeave(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The clock is about to park for the app: every room listening stops. */
export function announceAppLeave(): void {
  // A room ending can take another listener with it: one gone meanwhile
  // hears nothing.
  for (const listener of [...listeners]) {
    if (listeners.has(listener)) listener()
  }
}
