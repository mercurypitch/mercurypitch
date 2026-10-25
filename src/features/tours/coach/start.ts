// ============================================================
// Coach start — runs a Merc tour, loading the coach on the first one
// ============================================================
//
// The one door to the coach, and the only part of it a page imports
// statically: the runner, the layer and Merc's renderer load when a tour
// starts (or earlier, from warmCoach), so no page's first paint carries them.
//
// - One tour at a time. Starting one ends the tour on screen first, with
//   'exit', and a tour still loading when another starts never shows.
// - coachActive() names the tour from the moment it is asked for until its
//   layer is gone, its hand-over included, so a host that offers tours
//   (the chip, the legacy walkthrough) waits for it.
// - The layer mounts in a #coach-root of its own on <body>, outside #app,
//   which a full-screen stage makes inert while it is up.

import { coachActive, setCoachActive } from '@/lib/coach-state'
import type { CoachHandoff, CoachTour } from '@/lib/coach-types'
import type { CoachEnd } from './runner'

export interface CoachHandle {
  /** Ends the tour now: an exit where it stands, or the hand-over closed. */
  end(): void
  /** Settles once the layer is gone, with how the tour itself ended. */
  ended: Promise<CoachEnd>
}

export interface CoachStartOptions {
  /** A phone's layout: a sheet above the tab bar, and the phone's steps. */
  phone?: boolean
  /** What the bubble offers once the tour is done. */
  handoff?: () => CoachHandoff | null
  onEnd?: (result: CoachEnd) => void
}

export const COACH_ROOT_ID = 'coach-root'

const loadCoach = () =>
  Promise.all([import('./runner'), import('./CoachLayer')])

let generation = 0
let running: CoachHandle | null = null

/** Fetches the coach and Merc's renderer ahead of a tour, without starting one. */
export function warmCoach(): void {
  void loadCoach().catch(() => undefined)
  void import('@/lib/merc/stage').catch(() => undefined)
}

/**
 * Ends the Merc tour on screen as an exit, where it stands, and drops one
 * still loading before it shows. For a page that moves on under a tour: a
 * tab change, or the legacy spotlight starting.
 */
export function endCoachTour(): void {
  if (running !== null) {
    running.end()
    return
  }
  if (coachActive() !== null) {
    generation += 1
    setCoachActive(null)
  }
}

const over = (result: CoachEnd, onEnd?: (r: CoachEnd) => void): CoachHandle => {
  onEnd?.(result)
  return { end: () => undefined, ended: Promise.resolve(result) }
}

export async function startCoachTour(
  tour: CoachTour,
  opts: CoachStartOptions = {},
): Promise<CoachHandle> {
  running?.end()
  running = null
  const mine = ++generation
  setCoachActive(tour.key)

  let modules: Awaited<ReturnType<typeof loadCoach>>
  try {
    modules = await loadCoach()
  } catch (error) {
    if (mine === generation) setCoachActive(null)
    throw error
  }
  // Another tour was asked for while this one loaded: it never shows.
  if (mine !== generation) return over('exit', opts.onEnd)
  const [{ createCoachRunner }, { mountCoachLayer }] = modules

  const runner = createCoachRunner(tour, { phone: opts.phone })
  if (runner.ended() !== null) {
    setCoachActive(null)
    return over(runner.ended() ?? 'done', opts.onEnd)
  }

  let settle!: (r: CoachEnd) => void
  const ended = new Promise<CoachEnd>((resolve) => {
    settle = resolve
  })
  const root = document.createElement('div')
  root.id = COACH_ROOT_ID
  document.body.append(root)

  let closed = false
  let unmount: () => void = () => undefined
  const close = (): void => {
    if (closed) return
    closed = true
    runner.dispose()
    if (running === handle) running = null
    if (mine === generation) setCoachActive(null)
    // The layer asks for its own close from inside its effects; unmount
    // after they have run.
    queueMicrotask(() => {
      unmount()
      root.remove()
    })
    // How the tour itself ended: done, even after a hand-over the singer
    // put off; an exit, if it never got that far.
    const result = runner.ended() ?? 'exit'
    opts.onEnd?.(result)
    settle(result)
  }

  const handle: CoachHandle = {
    end() {
      if (closed) return
      if (runner.ended() === null) runner.exit()
      close()
    },
    ended,
  }
  running = handle
  unmount = mountCoachLayer(root, {
    runner,
    phone: opts.phone === true,
    handoff: opts.handoff,
    onClose: close,
  })
  return handle
}
