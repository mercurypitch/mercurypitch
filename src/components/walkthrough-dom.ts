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

/** The part of the window a target can be seen in, top and bottom edges in px. */
export interface Band {
  top: number
  bottom: number
}

/** The tour's own layers lie over everything and hide nothing. */
const TOUR_LAYER = '[data-tour-layer]'
/** Room kept between a target and what is pinned over it, past the ring's 6 px. */
const CLEAR = 8
/** How far in from a band's edges the probes look for something pinned there. */
const EDGE_REACH = 72
const PROBE_STEP = 12
/** How far a target may overrun its band before it is scrolled. */
const SLACK = 2

/** The window as the boxes that scroll `el` show it: each one's box, cut to the window. */
export function scrollBand(el: Element): Band {
  let top = 0
  let bottom = window.innerHeight
  for (
    let box = el.parentElement;
    box !== null && box !== document.body;
    box = box.parentElement
  ) {
    const { overflowY } = window.getComputedStyle(box)
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    const b = box.getBoundingClientRect()
    top = Math.max(top, b.top)
    bottom = Math.min(bottom, b.bottom)
  }
  return { top, bottom }
}

/**
 * What is fixed or stuck in place and lies over the page at (x, y): the
 * phone's tab bar, Path's view switch. Null where `el` itself, or something
 * that scrolls with the page, is on top, and for a pinned box that holds `el`
 * (a target in the header) or that `el` holds.
 */
function pinnedAt(el: Element, x: number, y: number): Element | null {
  // jsdom draws nothing and has no hit test.
  if (typeof document.elementsFromPoint !== 'function') return null
  const hit = document
    .elementsFromPoint(x, y)
    .find((found) => found.closest(TOUR_LAYER) === null)
  if (hit === undefined || el.contains(hit)) return null
  for (
    let box: Element | null = hit;
    box !== null && box !== document.body;
    box = box.parentElement
  ) {
    const { position } = window.getComputedStyle(box)
    if (position !== 'fixed' && position !== 'sticky') continue
    return box.contains(el) || el.contains(box) ? null : box
  }
  return null
}

/**
 * `view` less what is pinned over its top and foot, where `el` would show.
 * The window check alone let Home's Ascent card sit under the phone's tab
 * bar, and a tall Path card scrolled to the top slid under the view switch.
 */
export function openBand(el: Element, view: Band): Band {
  const r = el.getBoundingClientRect()
  const xs = [0.25, 0.5, 0.75].map((share) =>
    Math.min(Math.max(r.left + r.width * share, 1), window.innerWidth - 1),
  )
  let { top, bottom } = view
  for (let dy = 1; dy <= EDGE_REACH; dy += PROBE_STEP) {
    for (const x of xs) {
      const over = pinnedAt(el, x, view.top + dy)
      if (over !== null)
        top = Math.max(top, over.getBoundingClientRect().bottom)
      const under = pinnedAt(el, x, view.bottom - dy)
      if (under !== null) {
        bottom = Math.min(bottom, under.getBoundingClientRect().top)
      }
    }
  }
  return { top, bottom }
}

/**
 * Scrolls `el` into the band it can be seen in when part of it is outside,
 * or hidden by a box that scrolls. True when it scrolled, so the caller
 * re-positions once the layout has settled.
 */
export function scrollTargetIntoView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  const view = scrollBand(el)
  const open = openBand(el, view)
  const room = open.bottom - open.top
  // A target that fits shows whole. One taller than the band shows its top,
  // in the band's upper half, and is not scrolled while it does.
  const needsScrollV =
    r.top < open.top - SLACK ||
    (r.height <= room
      ? r.bottom > open.bottom + SLACK
      : r.top > open.top + room / 2)
  // Horizontally-scrolling containers (e.g. the overflow-x control bar on
  // mobile/narrow screens) can park a target off to the side while it's still
  // vertically in view. Detect that too so scrollIntoView reels in the right
  // scroll ancestor — otherwise toolbar steps (BPM, Volume, play modes) would
  // highlight an off-screen element.
  const margin = 80
  const needsScrollH = r.left < -margin || r.right > window.innerWidth + margin
  if (!needsScrollV && !needsScrollH && !clippedByScroller(el)) return false

  // Targets taller than most of the band (e.g. a full card grid) look wrong
  // centered — it scrolls past their top. Align those to the top instead;
  // center everything else. Instant scroll so highlight/tooltip update
  // immediately. A target only its own scroller hides moves the least it can
  // up or down, so the page under it stays where it was. Scroll margins as
  // deep as the pinned bars keep it clear of them wherever it lands.
  const tall = r.height > room * 0.8
  const style =
    el instanceof HTMLElement || el instanceof SVGElement ? el.style : null
  const kept = [style?.scrollMarginTop ?? '', style?.scrollMarginBottom ?? '']
  if (style !== null) {
    if (open.top > view.top) {
      style.scrollMarginTop = `${open.top - view.top + CLEAR}px`
    }
    if (open.bottom < view.bottom) {
      style.scrollMarginBottom = `${view.bottom - open.bottom + CLEAR}px`
    }
  }
  el.scrollIntoView({
    behavior: 'auto',
    block: tall ? 'start' : needsScrollV ? 'center' : 'nearest',
    inline: 'center',
  })
  if (style !== null) {
    style.scrollMarginTop = kept[0]
    style.scrollMarginBottom = kept[1]
  }
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
