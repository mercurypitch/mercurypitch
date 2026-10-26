// ============================================================
// Coach runner — which step of a Merc tour is on screen, and why it moves
// ============================================================
//
// No DOM here: the layer (CoachLayer.tsx) draws what the runner says, so the
// rules can be tested with a fake clock and a fake event bus.
//
// - The steps for the other kind of screen are dropped when the runner is made,
//   so "2 of 4" counts what this singer will see. A quiet step (Karaoke's wait
//   through the song) is not counted either: it draws nothing, so "N of M"
//   counts the stops the singer reads, and the tour events count the same.
// - A do-step listens only from the moment it shows. A note sung during the
//   step before does not count, or the tour would rush past the step that asks
//   for one.
// - When the singer does the thing, Merc celebrates for CELEBRATE_MS and the
//   step moves on by itself. Skip moves on at once, with no celebration, and
//   so does a quiet step's event: nothing of it was on screen. Back passes
//   over a quiet step, and the way on passes one the singer is through. A
//   step's `alsoFor` events move it on as its own does, and its `endsOn`
//   events end the tour as an exit where it stands: what it waits for can no
//   longer come (Karaoke's wait through a song, when another song is staged).
// - A do-step whose thing is already done as it shows (`doneAlready`: the mic
//   was on before the tour), or that the singer did earlier in this run and
//   Back has returned to, does not wait: it offers Next, as a show step
//   does. One that was skipped waits again. One whose `failure` event comes while it waits is marked failed,
//   for the layer to say why, and still waits.
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
import type { CoachDoStep, CoachStep, CoachTour } from '@/lib/coach-types'
import { trackTour } from '@/lib/guide-funnel'

/** How long Merc celebrates a done do-step before the next step shows. */
export const CELEBRATE_MS = 900

export interface CoachSnapshot {
  /** 0-based, among the steps this screen shows, quiet ones included. */
  index: number
  /** 1-based, among the counted steps: what "N of M" says. */
  place: number
  /** How many counted steps this screen shows. */
  total: number
  /** The final step: its forward button says Done. */
  last: boolean
  step: CoachStep
  /** True while a do-step waits for the singer: Next is Skip until it is done. */
  waiting: boolean
  /** True from a do-step's event until the next step shows. */
  celebrating: boolean
  /** True once the waiting step's failure event came, until it moves on. */
  failed: boolean
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

/** A wait that draws nothing and is not counted (coach-types.ts). */
export const isQuiet = (step: CoachStep | undefined): boolean =>
  step?.kind === 'do' && step.quiet === true

export function createCoachRunner(
  tour: CoachTour,
  deps: CoachRunnerDeps = {},
): CoachRunner {
  const track = deps.track ?? trackTour
  const on = deps.on ?? onCoachEvent
  const steps = tour.steps.filter((step) =>
    forScreen(step, deps.phone === true),
  )
  // Each step's place in "N of M": a quiet step keeps its predecessor's.
  const places: number[] = []
  for (const step of steps) {
    places.push((places.at(-1) ?? 0) + (isQuiet(step) ? 0 : 1))
  }
  const total = places.at(-1) ?? 0
  const [snapshot, setSnapshot] = createSignal<CoachSnapshot | null>(null)
  const [ended, setEnded] = createSignal<CoachEnd | null>(null)
  // The do-steps the singer has done in this run, by index.
  const done = new Set<number>()
  // What the waiting step listens to: its events, its failure, its ends.
  let listening: (() => void)[] = []
  let celebration: ReturnType<typeof setTimeout> | null = null
  let over = false

  const stopWaiting = (): void => {
    for (const off of listening) off()
    listening = []
    if (celebration !== null) clearTimeout(celebration)
    celebration = null
  }

  const end = (result: CoachEnd): void => {
    if (over) return
    const at = untrack(snapshot)
    over = true
    stopWaiting()
    setSnapshot(null)
    setEnded(result)
    if (result === 'done') {
      track('tour_done', tour.key, { step: total, of: total })
    } else {
      track('tour_exit', tour.key, { step: at?.place ?? 1, of: total })
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
    if (step.kind === 'do' && untrack(() => step.doneAlready?.()) === true) {
      done.add(index)
    }
    if (isQuiet(step) && done.has(index)) {
      show(index + 1)
      return
    }
    const at = {
      index,
      place: places[index] ?? 0,
      total,
      last: index === steps.length - 1,
      step,
      celebrating: false,
      failed: false,
    }
    const waiting = step.kind === 'do' && !done.has(index)
    setSnapshot({ ...at, waiting })
    if (step.kind === 'do' && waiting) wait(step, at)
  }

  /** Listens while the do-step `at` shows for what moves it on or ends it. */
  const wait = (
    step: CoachDoStep,
    at: Omit<CoachSnapshot, 'waiting'>,
  ): void => {
    const heard = (): void => {
      stopWaiting()
      done.add(at.index)
      if (step.quiet === true) {
        show(at.index + 1)
        return
      }
      setSnapshot({ ...at, waiting: false, celebrating: true })
      celebration = setTimeout(() => {
        celebration = null
        show(at.index + 1)
      }, CELEBRATE_MS)
    }
    if (step.failure !== undefined) {
      listening.push(
        on(step.failure.event, () => {
          setSnapshot({ ...at, waiting: true, failed: true })
        }),
      )
    }
    for (const name of [step.waitFor, ...(step.alsoFor ?? [])]) {
      listening.push(on(name, heard))
    }
    for (const name of step.endsOn ?? []) {
      listening.push(on(name, () => end('exit')))
    }
  }

  const current = (): CoachSnapshot | null => (over ? null : untrack(snapshot))

  if (steps.length === 0) {
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
      if (at === null || at.waiting) return
      show(at.index + 1)
    },
    back() {
      const at = current()
      if (at === null) return
      let to = at.index - 1
      while (to >= 0 && isQuiet(steps[to])) to -= 1
      if (to >= 0) show(to)
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
