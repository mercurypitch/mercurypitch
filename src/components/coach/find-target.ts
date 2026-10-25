// ============================================================
// findTarget — what a tour step or a showcase stop points at, if it is there
// ============================================================
//
// Shared by the tour layer and the showcase. A match that is not laid out (a
// hidden tab's control) or that sits under an inert page (a full-screen stage
// is up) is not there to point at, so the next match is tried.

/** The first match that is on the page to be seen: laid out, and not under an inert page. */
export function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.closest('[inert]') !== null) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}
