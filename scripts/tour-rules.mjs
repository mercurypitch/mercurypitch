// ============================================================
// tour-rules: two rules a tour walk checks at every stop
// ============================================================
//
// - targetFits: a stop rings its target only when the target is at most 70%
//   of the window's height. A taller one (a page-long grid, the Sing stage's
//   canvas on a wide screen) rings the page rather than a thing, so Merc's
//   coach stands its bubble clear of it instead (RING_MAX_SHARE in
//   src/components/coach/CoachLayer.tsx).
// - barOnTop: while the consent bar waits for an answer, nothing a tour puts
//   up may cover it. probeConsentBar, run in the page, puts up a stand-in
//   for the bar and hit-tests the middle of each of its buttons; barOnTop
//   reads the answers.
//
// scripts/walk-tours.mjs applies both to the Guide's spotlight tours, and
// src/e2e/coach-tours.spec.ts to Merc's.
//
// - standsClear: the Guide's tooltip, unlike Merc's bubble, can stand beside
//   a tall target (Walkthrough.tsx, walkthrough-place.ts), and a tall target
//   it stands clear of is a thing the step is about, not the page: the
//   drawer's Load a Melody (253 x 342) and the piano roll's keys (74 x 342)
//   on a phone on its side, 844x390, where 70% of the height is 273 px. The
//   walk lets a tall spotlight pass when the tooltip takes none of it.

/** The share of the window's height a ringed target may take. */
export const TARGET_MAX_SHARE = 0.7

/**
 * Whether a target is small enough to ring: at most 70% of the window's
 * height.
 *
 * @param {{ height: number }} rect the target's box
 * @param {{ height: number }} viewport the window
 * @returns {boolean}
 */
export function targetFits(rect, viewport) {
  return rect.height <= viewport.height * TARGET_MAX_SHARE
}

/**
 * Whether a tooltip takes none of a spotlight: their boxes meet nowhere.
 *
 * @param {{ x: number, y: number, width: number, height: number }} spot the
 *   spotlight's box
 * @param {{ x: number, y: number, width: number, height: number } | null}
 *   tooltip the tooltip's box; none proves nothing, so it fails
 * @returns {boolean}
 */
export function standsClear(spot, tooltip) {
  if (tooltip === null) return false
  return (
    tooltip.x >= spot.x + spot.width ||
    spot.x >= tooltip.x + tooltip.width ||
    tooltip.y >= spot.y + spot.height ||
    spot.y >= tooltip.y + tooltip.height
  )
}

/**
 * Whether the consent bar is on top: every hit-test of its buttons' middles
 * landed inside the bar. No hit-test at all proves nothing, so it fails.
 *
 * @param {readonly boolean[]} hits one per button, true for a hit inside the
 *   bar
 * @returns {boolean}
 */
export function barOnTop(hits) {
  return hits.length > 0 && hits.every((hit) => hit)
}

/**
 * Runs in the page, through page.evaluate: puts up a stand-in for the
 * consent bar where the real one stands (src/components/ConsentBanner.tsx: a
 * dialog named "Cookie consent", fixed to the foot of the window at z-index
 * 2147483000, with its answers as buttons), hit-tests the middle of each
 * button, and takes the bar down again. The test and e2e builds put up no
 * banner of their own, as they configure no tag.
 *
 * Self-contained, as page.evaluate sends only the function's source.
 *
 * @returns {boolean[]} one answer per button, true for a hit inside the bar
 */
export function probeConsentBar() {
  // Run in the page (page.evaluate), so its globals are the page's.
  const doc = globalThis.document
  const bar = doc.createElement('div')
  bar.setAttribute('role', 'dialog')
  bar.setAttribute('aria-label', 'Cookie consent')
  bar.style.cssText =
    'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;' +
    'display:flex;gap:8px;justify-content:flex-end;padding:12px'
  for (const name of ['Decline', 'Accept']) {
    const button = doc.createElement('button')
    button.type = 'button'
    button.textContent = name
    button.style.cssText = 'min-height:44px;min-width:88px'
    bar.append(button)
  }
  doc.body.append(bar)
  try {
    return [...bar.querySelectorAll('button')].map((button) => {
      const box = button.getBoundingClientRect()
      const hit = doc.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit !== null && bar.contains(hit)
    })
  } finally {
    bar.remove()
  }
}
