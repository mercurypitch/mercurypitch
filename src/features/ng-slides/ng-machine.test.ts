// ============================================================
// Ng slides' states
// ============================================================

import { describe, expect, it } from 'vitest'
import type { NgEvent, NgPhase, NgState } from './ng-machine'
import { initialNgState, isRunPhase, ngMicState, ngReducer } from './ng-machine'

const play = (events: readonly NgEvent[], from = initialNgState()): NgState =>
  events.reduce(ngReducer, from)

describe('a run', () => {
  it('goes from the tap through the mic to the slides and the result', () => {
    const state = play([
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: true },
      { type: 'finished' },
    ])

    expect(state).toEqual({ phase: 'result', run: 1, block: null })
  })

  it('asks for an easy note first when it has no root', () => {
    const settling = play([
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: false },
    ])
    expect(settling.phase).toBe('settle')

    expect(ngReducer(settling, { type: 'settled' }).phase).toBe('run')
  })

  it('ignores a mic that opens for an earlier start', () => {
    const state = play([
      { type: 'start' },
      { type: 'stop' },
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: true },
    ])

    expect(state.phase).toBe('starting')
    expect(state.run).toBe(2)
  })

  it('stops at a blocked mic, and starts again from it', () => {
    const blocked = play([
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    ])
    expect(blocked).toEqual({ phase: 'blocked', run: 1, block: 'denied' })

    expect(ngReducer(blocked, { type: 'start' })).toEqual({
      phase: 'starting',
      run: 2,
      block: null,
    })
  })
})

describe('dropping a run', () => {
  it.each(['stop', 'rest', 'leave'] as const)(
    'goes back to the intro on %s, from any part of the run',
    (type) => {
      for (const at of [
        [{ type: 'start' }],
        [{ type: 'start' }, { type: 'mic-ready', run: 1, rooted: false }],
        [{ type: 'start' }, { type: 'mic-ready', run: 1, rooted: true }],
      ] as NgEvent[][]) {
        expect(play([...at, { type }]).phase).toBe('intro')
      }
    },
  )

  it('leaves a result or the intro as they are', () => {
    const result = play([
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: true },
      { type: 'finished' },
    ])
    expect(ngReducer(result, { type: 'stop' })).toBe(result)
    expect(ngReducer(initialNgState(), { type: 'leave' }).phase).toBe('intro')
  })
})

describe('isRunPhase', () => {
  it('is true while the mic is asked for or open', () => {
    expect(
      ['starting', 'settle', 'run'].every((p) => isRunPhase(p as never)),
    ).toBe(true)
    expect(
      ['intro', 'result', 'blocked'].some((p) => isRunPhase(p as never)),
    ).toBe(false)
  })
})

describe('the demo', () => {
  it('moves the room to a slide and back, a new run each move', () => {
    const slide = play([{ type: 'demo', phase: 'run' }])
    expect(slide).toEqual({ phase: 'run', run: 1, block: null })

    const back = ngReducer(slide, { type: 'demo', phase: 'intro' })
    expect(back).toEqual({ phase: 'intro', run: 2, block: null })
  })

  it('starts from a result too', () => {
    const result = play([
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: true },
      { type: 'finished' },
    ])

    expect(ngReducer(result, { type: 'demo', phase: 'run' }).phase).toBe('run')
  })

  it('never moves a room whose mic is opening or blocked', () => {
    const starting = play([{ type: 'start' }])
    expect(ngReducer(starting, { type: 'demo', phase: 'run' })).toBe(starting)

    const blocked = play([
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    ])
    expect(ngReducer(blocked, { type: 'demo', phase: 'run' })).toBe(blocked)
  })

  it('lands no mic answer from before it', () => {
    const state = play([
      { type: 'start' },
      { type: 'stop' },
      { type: 'demo', phase: 'run' },
      { type: 'mic-ready', run: 1, rooted: true },
    ])

    expect(state).toEqual({ phase: 'run', run: 2, block: null })
  })
})

describe('the mic in each phase', () => {
  const PHASES: readonly NgPhase[] = [
    'intro',
    'starting',
    'settle',
    'run',
    'result',
    'blocked',
  ]

  it('is the singer turn in the settle and while a slide is sung', () => {
    const states = PHASES.map((phase) => [
      phase,
      [ngMicState(phase, false, false), ngMicState(phase, true, false)],
    ])

    expect(Object.fromEntries(states)).toEqual({
      intro: ['ready', 'ready'],
      starting: ['wait', 'wait'],
      settle: ['sing', 'sing'],
      run: ['wait', 'sing'],
      result: ['done', 'done'],
      blocked: ['ready', 'ready'],
    })
  })

  it('waits through the whole demo, a sung slide included', () => {
    const states = PHASES.map((phase) => ngMicState(phase, true, true))

    expect(states).toEqual(
      PHASES.map((phase) => (phase === 'result' ? 'done' : 'wait')),
    )
  })
})
