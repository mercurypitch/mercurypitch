// The coach runner's rules, with a fake clock and a fake event bus: a do-step
// waits for the singer, Skip always moves on, and the tour events say where
// the singer finished or left.

import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachEventName } from '@/lib/coach-events'
import type { CoachDoStep, CoachShowStep, CoachStep, CoachTour, } from '@/lib/coach-types'
import type { CoachRunnerDeps } from './runner'
import { CELEBRATE_MS, createCoachRunner } from './runner'

/** A bus that only delivers to listeners subscribed when the event is sent. */
function fakeBus(): {
  on: NonNullable<CoachRunnerDeps['on']>
  send: (name: CoachEventName) => void
} {
  const listeners = new Set<{ name: CoachEventName; fn: () => void }>()
  return {
    on(name, fn) {
      const entry = { name, fn }
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    send(name) {
      for (const entry of [...listeners]) if (entry.name === name) entry.fn()
    },
  }
}

const show = (
  id: string,
  extra: Partial<CoachShowStep> = {},
): CoachShowStep => ({
  id,
  kind: 'show',
  title: id,
  body: `${id} body`,
  merc: 'point',
  ...extra,
})

const doStep = (
  id: string,
  waitFor: CoachEventName,
  extra: Partial<CoachDoStep> = {},
): CoachStep => ({
  id,
  kind: 'do',
  title: id,
  body: `${id} body`,
  merc: 'listen',
  waitFor,
  ...extra,
})

/** Four steps like the Sing tour's: show, do, show, watch. */
const SING: CoachTour = {
  key: 'sing',
  steps: [
    show('mic'),
    doStep('note', 'pitch-detected'),
    show('line'),
    show('takes', { kind: 'watch' }),
  ],
}

describe('createCoachRunner', () => {
  let bus: ReturnType<typeof fakeBus>
  let track: Mock<NonNullable<CoachRunnerDeps['track']>>

  beforeEach(() => {
    vi.useFakeTimers()
    bus = fakeBus()
    track = vi.fn<NonNullable<CoachRunnerDeps['track']>>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const start = (tour: CoachTour = SING, extra: CoachRunnerDeps = {}) =>
    createCoachRunner(tour, { on: bus.on, track, ...extra })

  it('waits on a do step until its event arrives', () => {
    const runner = start()
    runner.next()
    expect(runner.snapshot()?.step.id).toBe('note')

    vi.advanceTimersByTime(60_000)
    runner.next()
    expect(runner.snapshot()).toMatchObject({ index: 1, celebrating: false })

    bus.send('pitch-detected')
    expect(runner.snapshot()).toMatchObject({ index: 1, celebrating: true })

    vi.advanceTimersByTime(CELEBRATE_MS - 1)
    expect(runner.snapshot()?.index).toBe(1)
    vi.advanceTimersByTime(1)
    expect(runner.snapshot()).toMatchObject({ index: 2, celebrating: false })
  })

  it('ignores an event from before the step', () => {
    const runner = start()
    bus.send('pitch-detected')
    runner.next()
    vi.advanceTimersByTime(CELEBRATE_MS * 2)

    expect(runner.snapshot()).toMatchObject({ index: 1, celebrating: false })
  })

  it('ignores an event the step does not wait for', () => {
    const runner = start()
    runner.next()
    bus.send('song-staged')
    vi.advanceTimersByTime(CELEBRATE_MS * 2)

    expect(runner.snapshot()).toMatchObject({ index: 1, celebrating: false })
  })

  it('moves on without celebrating when Skip is tapped', () => {
    const runner = start()
    runner.next()
    runner.skip()

    expect(runner.snapshot()).toMatchObject({ index: 2, celebrating: false })
    // The skipped step stopped listening: a late note changes nothing.
    bus.send('pitch-detected')
    vi.advanceTimersByTime(CELEBRATE_MS * 2)
    expect(runner.snapshot()?.index).toBe(2)
  })

  it('does not wait on a do step that is already done as it shows', () => {
    const runner = start({
      key: 'sing',
      steps: [
        doStep('mic', 'mic-on', { doneAlready: () => true }),
        show('line'),
      ],
    })

    // The mic was on before the tour: nothing is left to wait for.
    expect(runner.snapshot()).toMatchObject({
      index: 0,
      waiting: false,
      celebrating: false,
    })
    runner.next()
    expect(runner.snapshot()?.step.id).toBe('line')
  })

  it('asks whether a do step is done only as it shows', () => {
    let micOn = false
    const runner = start({
      key: 'sing',
      steps: [
        doStep('mic', 'mic-on', { doneAlready: () => micOn }),
        show('line'),
      ],
    })
    micOn = true

    expect(runner.snapshot()).toMatchObject({ index: 0, waiting: true })
    runner.next()
    expect(runner.snapshot()?.index).toBe(0)
    bus.send('mic-on')
    expect(runner.snapshot()).toMatchObject({
      index: 0,
      waiting: false,
      celebrating: true,
    })
  })

  it('marks a waiting step failed when its failure comes, and still waits', () => {
    const failure = {
      event: 'mic-failed',
      aside: { title: 'No mic.', sub: 'Allow it.' },
    } as const
    const runner = start({
      key: 'sing',
      steps: [doStep('mic', 'mic-on', { failure }), show('line')],
    })
    expect(runner.snapshot()).toMatchObject({ waiting: true, failed: false })

    bus.send('mic-failed')
    expect(runner.snapshot()).toMatchObject({
      index: 0,
      waiting: true,
      failed: true,
    })
    runner.next()
    expect(runner.snapshot()?.index).toBe(0)

    // The singer allows the mic and taps it again.
    bus.send('mic-on')
    expect(runner.snapshot()).toMatchObject({
      index: 0,
      celebrating: true,
      failed: false,
    })
    vi.advanceTimersByTime(CELEBRATE_MS)
    expect(runner.snapshot()).toMatchObject({ index: 1, failed: false })

    // Past the step, a failure is nobody's business.
    bus.send('mic-failed')
    expect(runner.snapshot()).toMatchObject({ index: 1, failed: false })
  })

  it('goes back a step, and not before the first', () => {
    const runner = start()
    runner.back()
    expect(runner.snapshot()?.index).toBe(0)
    runner.next()
    runner.skip()
    runner.back()
    expect(runner.snapshot()?.step.id).toBe('note')
  })

  it('reports the start with how many steps this run shows', () => {
    start()
    expect(track).toHaveBeenCalledExactlyOnceWith('tour_start', 'sing', {
      of: 4,
    })
  })

  it('reports done past the last step', () => {
    const onEnd = vi.fn()
    const runner = start(SING, { onEnd })
    runner.next()
    bus.send('pitch-detected')
    vi.advanceTimersByTime(CELEBRATE_MS)
    runner.next()
    runner.next()

    expect(runner.snapshot()).toBeNull()
    expect(runner.ended()).toBe('done')
    expect(track).toHaveBeenLastCalledWith('tour_done', 'sing', {
      step: 4,
      of: 4,
    })
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done')
  })

  it('reports the step a singer left on', () => {
    const onEnd = vi.fn()
    const runner = start(SING, { onEnd })
    runner.next()
    runner.exit()
    runner.exit()

    expect(runner.snapshot()).toBeNull()
    expect(runner.ended()).toBe('exit')
    expect(track).toHaveBeenLastCalledWith('tour_exit', 'sing', {
      step: 2,
      of: 4,
    })
    expect(track).toHaveBeenCalledTimes(2)
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('exit')
  })

  it('reports nothing when its host goes away', () => {
    const onEnd = vi.fn()
    const runner = start(SING, { onEnd })
    runner.next()
    runner.dispose()
    bus.send('pitch-detected')
    vi.advanceTimersByTime(CELEBRATE_MS * 2)
    runner.next()

    expect(runner.snapshot()).toBeNull()
    expect(runner.ended()).toBeNull()
    expect(track.mock.calls.map((call) => call[0])).toEqual(['tour_start'])
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('is done at once, reporting nothing, when no step is for this screen', () => {
    const onEnd = vi.fn()
    const runner = start(
      { key: 'sing', steps: [show('desk-only', { viewport: 'desktop' })] },
      { phone: true, onEnd },
    )

    expect(runner.snapshot()).toBeNull()
    expect(runner.ended()).toBe('done')
    expect(track).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('drops steps meant for the other viewport', () => {
    const tour: CoachTour = {
      key: 'sing',
      steps: [
        show('phone-mic', { viewport: 'phone' }),
        show('desk-mic', { viewport: 'desktop' }),
        show('line'),
      ],
    }
    const ids = (phone: boolean): string[] => {
      const runner = start(tour, { phone })
      const seen: string[] = []
      for (let at = runner.snapshot(); at !== null; at = runner.snapshot()) {
        seen.push(at.step.id)
        runner.next()
      }
      return seen
    }

    expect(ids(true)).toEqual(['phone-mic', 'line'])
    expect(ids(false)).toEqual(['desk-mic', 'line'])
    expect(track).toHaveBeenCalledWith('tour_start', 'sing', { of: 2 })
    expect(track).toHaveBeenCalledWith('tour_done', 'sing', { step: 2, of: 2 })
  })
})
