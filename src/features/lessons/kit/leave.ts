// ============================================================
// Lesson leave watch — what plays in a section stops once the viewer leaves it
// ============================================================
//
// Lesson 3's rule for leaving (lesson-03/sing.ts): a section's sound stops
// once the section has stayed off screen for 600 ms, when the page is
// hidden, and when it goes. Leaving is staying away: a panel that grows or
// shrinks can take the section off screen for a moment, and that must not
// stop a sweep, so a return within 600 ms cancels the stop. Lesson 10 moved
// it here from its Sing it, for its Sing it and its free play; Lesson 12
// leaves its hero, its Sing it and its free play by it.

/** How long a section may be off screen before what plays there stops, ms (Lesson 3's rule). */
export const AWAY_MS = 600

/** Calls `leave` once `section` has been off screen for 600 ms, when the page is hidden, and when it goes. */
export function onLeave(section: HTMLElement, leave: () => void): void {
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    // only the section is watched, so a report's last entry is where it stands now
    const last = entries[entries.length - 1]
    if (last !== undefined && !last.isIntersecting)
      away = window.setTimeout(leave, AWAY_MS)
  }).observe(section)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave()
  })
  window.addEventListener('pagehide', () => leave())
}
