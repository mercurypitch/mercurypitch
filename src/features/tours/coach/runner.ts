// ============================================================
// Coach runner — which step of a Merc tour is on screen, and why it moves
// ============================================================
//
// No DOM here: the layer (CoachLayer.tsx) draws what the runner says, so the
// rules can be tested with a fake clock and a fake event bus.
//
// - The steps for the other kind of screen are dropped when the runner is made,
//   so "2 of 4" counts what this singer will see.
// - A do-step listens only from the moment it shows. A note sung during the
//   step before does not count, or the tour would rush past the step that asks
//   for one.
// - When the singer does the thing, Merc celebrates for CELEBRATE_MS and the
//   step moves on by itself. Skip moves on at once, with no celebration.
// - The tour events carry what the legacy spotlight tours' events carry
//   (src/lib/guide-funnel.ts): tour_start how many steps this run shows,
//   tour_done the last of them, and tour_exit the 1-based step the singer
//   left on.
// - dispose() is for a host that goes away mid-tour and reports nothing. A
//   tab change is not that: it ends the tour with exit(), so its place is
//   reported.

import type { Accessor } from 'solid-js'
import { createSignal, untrack } from 'solid-js'
import { onCoachEvent } from '@/lib/coach-events'
import { trackTour } from '@/lib/guide-funnel'
import type { CoachStep, CoachTour } from './types'

/** How long Merc celebrates a done do-step before the next step shows. */
export const CELEBRATE_MS = 900

export interface CoachSnapshot {
  /** 0-based, among the steps this screen shows. */
  index: number
  total: number
  step: CoachStep
  /** True from a do-step's event until the next step shows. */
  celebrating: boolean
}

export interface CoachRunner {
  /** The step on screen; null once the tour is over. */
  snapshot: Accessor<CoachSnapshot | null>
  /** How the tour ended, once it has; null while it runs and after dispose(). */
  ended: Accessor<CoachEnd | null>
  /** The next step, or the end past the last. A waiting do-step ignores it. */
  next(): void
  back(): void
  /** Moves on at once, done or not. Every do-step's way out without its event. */
  skip(): void
  /** The singer ended the tour. Reports where. */
  exit(): void
  /** The host went away. Reports nothing. */
  dispose(): void
}

export type CoachEnd = 'done' | 'exit'

export interface CoachRunnerDeps {
  phone?: boolean
  track?: typeof trackTour
  on?: typeof onCoachEvent
  onEnd?: (result: CoachEnd) => void
}

const forScreen = (step: CoachStep, phone: boolean): boolean =>
  step.viewport === undefined || step.viewport === (phone ? 'phone' : 'desktop')

export function createCoachRunner(
  tour: CoachTour,
  deps: CoachRunnerDeps = {},
): CoachRunner {
  const track = deps.track ?? trackTour
  const on = deps.on ?? onCoachEvent
  const steps = tour.steps.filter((step) =>
    forScreen(step, deps.phone === true),
  )
  const total = steps.length
  const [snapshot, setSnapshot] = createSignal<CoachSnapshot | null>(null)
  const [ended, setEnded] = createSignal<CoachEnd | null>(null)
  let unlisten: (() => void) | null = null
  let celebration: ReturnType<typeof setTimeout> | null = null
  let over = false

  const stopWaiting = (): void => {
    unlisten?.()
    unlisten = null
    if (celebration !== null) clearTimeout(celebration)
    celebration = null
  }

  const end = (result: CoachEnd): void => {
    if (over) return
    const place = untrack(snapshot)
    over = true
    stopWaiting()
    setSnapshot(null)
    setEnded(result)
    if (result === 'done') {
      track('tour_done', tour.key, { step: total, of: total })
    } else {
      track('tour_exit', tour.key, { step: (place?.index ?? 0) + 1, of: total })
    }
    deps.onEnd?.(result)
  }

  const show = (index: number): void => {
    stopWaiting()
    const step = steps[index]
    if (step === undefined) {
      end('done')
      return
    }
    setSnapshot({ index, total, step, celebrating: false })
    if (step.kind !== 'do') return
    unlisten = on(step.waitFor, () => {
      unlisten?.()
      unlisten = null
      setSnapshot({ index, total, step, celebrating: true })
      celebration = setTimeout(() => {
        celebration = null
        show(index + 1)
      }, CELEBRATE_MS)
    })
  }

  const current = (): CoachSnapshot | null => (over ? null : untrack(snapshot))

  if (total === 0) {
    // Nothing for this screen: the tour is done before it starts, and there
    // is nothing to report.
    over = true
    setEnded('done')
  } else {
    track('tour_start', tour.key, { of: total })
    show(0)
  }

  return {
    snapshot,
    ended,
    next() {
      const at = current()
      if (at === null || at.step.kind === 'do') return
      show(at.index + 1)
    },
    back() {
      const at = current()
      if (at === null || at.index === 0) return
      show(at.index - 1)
    },
    skip() {
      const at = current()
      if (at === null) return
      show(at.index + 1)
    },
    exit() {
      end('exit')
    },
    dispose() {
      over = true
      stopWaiting()
      setSnapshot(null)
    },
  }
}
