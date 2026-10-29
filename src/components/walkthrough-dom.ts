// ============================================================
// walkthrough-dom: what the Guide's spotlight does to the page
// ============================================================
//
// The spotlight (Walkthrough.tsx) brings a step's target into view before it
// rings it, and shuts the groups it opened for earlier steps. Both are plain
// DOM work with no Solid in them, kept here so the component stays about its
// steps.

/**
 * True when a box that scrolls (overflow auto or scroll) has the target's
 * middle outside it. The window check cannot see that: the Singing bar,
 * wider than its stage once its sliders are open, scrolls sideways inside its
 * card, and a play-mode button scrolled out of the card still measures as on
 * screen, under the sidebar, where the spotlight then rang the sidebar's
 * character icons instead.
 */
export function clippedByScroller(el: Element): boolean {
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  for (
    let box = el.parentElement;
    box !== null && box !== document.body;
    box = box.parentElement
  ) {
    const { overflowX, overflowY } = window.getComputedStyle(box)
    const scrolls = (o: string): boolean => o === 'auto' || o === 'scroll'
    if (!scrolls(overflowX) && !scrolls(overflowY)) continue
    const b = box.getBoundingClientRect()
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true
  }
  return false
}

/**
 * Scrolls `el` into view when it is partly off the window, or hidden by a box
 * that scrolls. True when it scrolled, so the caller re-positions once the
 * layout has settled.
 */
export function scrollTargetIntoView(el: Element): boolean {
  const margin = 80
  const r = el.getBoundingClientRect()
  const needsScrollV = r.top < -margin || r.bottom > window.innerHeight + margin
  // Horizontally-scrolling containers (e.g. the overflow-x control bar on
  // mobile/narrow screens) can park a target off to the side while it's still
  // vertically in view. Detect that too so scrollIntoView reels in the right
  // scroll ancestor — otherwise toolbar steps (BPM, Volume, play modes) would
  // highlight an off-screen element.
  const needsScrollH = r.left < -margin || r.right > window.innerWidth + margin
  if (!needsScrollV && !needsScrollH && !clippedByScroller(el)) return false

  // Targets taller than most of the viewport (e.g. a full card grid) look
  // wrong centered — it scrolls past their top. Align those to the top
  // instead; center everything else. Instant scroll so highlight/tooltip
  // update immediately. A target only its own scroller hides moves the least
  // it can up or down, so the page under it stays where it was.
  const tall = r.height > window.innerHeight * 0.8
  el.scrollIntoView({
    behavior: 'auto',
    block: tall ? 'start' : needsScrollV ? 'center' : 'nearest',
    inline: 'center',
  })
  return true
}

/** Clicks the collapse toggle `selector` names shut, if it is open. */
export function shutToggle(selector: string): void {
  const toggle = document.querySelector(selector)
  if (
    toggle instanceof HTMLElement &&
    toggle.getAttribute('aria-expanded') === 'true'
  ) {
    toggle.click()
  }
}
