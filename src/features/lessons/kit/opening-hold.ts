// ============================================================
// Lesson opening hold — the page holds still while Merc and Tavi land, then the tour
// ============================================================
//
// Lessons 1 and 2 open on a shot: Merc and Tavi drop onto the stage and the
// bubbles speak, about 4.5 s in all (each lesson's entrance.ts). On the
// visit that offers the welcome tour, the tour waits for the shot to end,
// so its first step lights two characters at rest with their words up, and
// the page holds still meanwhile: a viewer who scrolled away at once missed
// the shot, and the tour then gave up, the page no longer at the top. The
// wait ends `HOLD_CAP` after the page started, however far the shot has
// got, as a hidden tab stalls it.
//
// The hold is first-paint code, never the tour's: it lifts as the tour
// opens or gives up (tour-gate.ts calls back once the tour has run, or its
// chunk has failed to load), at the cap whatever the tour is doing, when a
// layer opens (the lesson menu, a film playing, full screen), so the menu
// works as ever, when the page moves (a section link), and when the page
// is hidden. It is the lesson menu's scroll lock, overflow hidden on
// <html> (lesson-menu.css), which holds on iOS Safari too. A visit that
// offers no tour holds nothing, and a shot that does not play (reduced
// motion, a deep link, a page already scrolled) never asks.

import { holdTour } from './tour-gate'

/** How long after the page starts the tour waits for the opening at most, in ms. */
export const HOLD_CAP = 6000

/** The class on <html> that holds the page still (lesson-menu.css). */
const HOLD = 'tour-wait'

/**
 * Holds the page still, and the welcome tour back, until the opening has
 * `ended`, on the visit that offers the tour; holds nothing on any other.
 * Call it as the opening starts, in the same task as the masthead's start.
 */
export function holdForOpening(ended: Promise<unknown>): void {
  const root = document.documentElement
  const off = new AbortController()
  const layers = new MutationObserver(() => {
    if (document.querySelector('dialog[open]') !== null) lift()
  })
  let cap = 0
  let go = (): void => undefined
  const until = new Promise<void>((resolve) => {
    go = resolve
  })
  const lift = (): void => {
    root.classList.remove(HOLD)
    window.clearTimeout(cap)
    layers.disconnect()
    off.abort()
  }
  if (!holdTour(until, lift)) return
  root.classList.add(HOLD)
  cap = window.setTimeout(() => {
    lift()
    go()
  }, HOLD_CAP - performance.now())
  void ended.then(go, go)
  layers.observe(document.body, { subtree: true, attributeFilter: ['open'] })
  const on = { passive: true, signal: off.signal }
  document.addEventListener('fullscreenchange', lift, on)
  // a film's play does not bubble; the page's own scroll does, and a box's does not
  document.addEventListener('play', lift, { ...on, capture: true })
  window.addEventListener('scroll', lift, on)
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) lift()
    },
    on,
  )
}
