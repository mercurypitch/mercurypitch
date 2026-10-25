// ============================================================
// Showcase start — Merc's walk along the tab bar, then Start here
// ============================================================
//
// The plan's "Show me around" (D6), loaded when it is asked for: the plan's
// host closes and calls startShowcase with the plan, which draws the walk
// (Showcase.tsx) over the app and, at its end, done or skipped, opens Start
// here with the room's tour through the host's `enterStart`.
//
// - One Merc at a time. A Merc tour on screen ends first, and the walk is in
//   #coach-root, the coach's own root on <body>; that root is gone before
//   Start here opens, so a tour that follows never shares the screen with the
//   walk's Merc.
// - The app's offers wait for it. showcaseOn() is up from the start (the plan's
//   host raises it before it closes) and comes down after Start here has
//   opened, by when a room's tour has started and holds the offers itself.
// - It reports itself: showcase_done at the end, showcase_skipped on Skip.
//
// Generic over the plan's stop, so the coach imports nothing from the plan.

import { createComponent } from 'solid-js'
import { render } from 'solid-js/web'
import { COACH_ROOT_ID, endCoachTour, warmCoach, } from '@/components/coach/start'
import { setShowcaseOn } from '@/lib/coach-state'
import { isConsentBannerOpen } from '@/lib/consent'
import { trackGuide } from '@/lib/guide-funnel'
import type { ShowcaseEnd } from './Showcase'
import { Showcase } from './Showcase'
import type { ShowcaseMenu } from './showcase-stops'
import { showcaseStops } from './showcase-stops'

export type { ShowcaseEnd } from './Showcase'

/**
 * The screen and the menu as they stand (ShowcaseMenu: a phone's rail and
 * More, or the top bar's groups, and what the scope and mode put in them),
 * and what to do at the end.
 */
export interface ShowcaseOptions<S> extends ShowcaseMenu {
  /** Opens the plan's Start here, with its room's tour. Called once, at the end. */
  enterStart: (stop: S) => void
  onEnd?: (result: ShowcaseEnd) => void
}

let current: Promise<ShowcaseEnd> | null = null

/** Fetches what the walk and the tour after it need, ahead of "Show me around". */
export function warmShowcase(): void {
  warmCoach()
}

/** Runs the walk; settles once Start here has been opened. A second ask while one runs is the same walk. */
export function startShowcase<S>(
  plan: { start: S },
  opts: ShowcaseOptions<S>,
): Promise<ShowcaseEnd> {
  if (current !== null) return current
  endCoachTour()
  setShowcaseOn(true)
  const root = document.createElement('div')
  root.id = COACH_ROOT_ID
  document.body.append(root)

  let resolve!: (result: ShowcaseEnd) => void
  const walk = new Promise<ShowcaseEnd>((settle) => {
    resolve = settle
  })
  current = walk
  let unmount: () => void = () => undefined
  const end = (result: ShowcaseEnd): void => {
    // The walk's Merc leaves the page before anything opens. Its owner goes
    // a microtask later: this runs inside the walk's own handlers.
    root.remove()
    queueMicrotask(() => unmount())
    trackGuide(result === 'done' ? 'showcase_done' : 'showcase_skipped')
    try {
      opts.enterStart(plan.start)
    } finally {
      if (current === walk) current = null
      setShowcaseOn(false)
      opts.onEnd?.(result)
      resolve(result)
    }
  }
  unmount = render(
    () =>
      createComponent(Showcase, {
        stops: showcaseStops(opts),
        phone: opts.phone,
        held: isConsentBannerOpen,
        onEnd: end,
      }),
    root,
  )
  return walk
}
