// ============================================================
// Echo's room states: every way in and out of each phase
// ============================================================

import { describe, expect, it } from 'vitest'
import type { EchoEvent, EchoState } from './echo-machine'
import { echoReducer, initialEchoState, isRunPhase } from './echo-machine'

const run = (events: readonly EchoEvent[], from = initialEchoState(5)) =>
  events.reduce<EchoState>(echoReducer, from)

/** A started run whose mic opened with a root: the first call. */
const calling = (): EchoState =>
  run([{ type: 'start' }, { type: 'mic-ready', run: 1, rooted: true }])

describe('the Echo room machine', () => {
  it('opens on the intro, before any phrase', () => {
    expect(initialEchoState(5)).toEqual({
      phase: 'intro',
      phrase: -1,
      phrases: 5,
      run: 0,
      block: null,
    })
  })

  it('numbers each start and goes to the first call once the mic opens with a root', () => {
    const started = run([{ type: 'start' }])
    expect(started.phase).toBe('starting')
    expect(started.run).toBe(1)

    expect(calling()).toMatchObject({ phase: 'call', phrase: 0, run: 1 })
  })

  it("listens for the singer's own note first when there is no root", () => {
    const settling = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1, rooted: false },
    ])
    expect(settling.phase).toBe('settle')

    expect(echoReducer(settling, { type: 'settled' })).toMatchObject({
      phase: 'call',
      phrase: 0,
    })
  })

  it('drops a mic answer that arrives for a start the singer already left', () => {
    const left = run([{ type: 'start' }, { type: 'stop' }, { type: 'start' }])
    expect(left.run).toBe(2)

    const stale = echoReducer(left, { type: 'mic-ready', run: 1, rooted: true })
    expect(stale).toBe(left)
    const staleFail = echoReducer(left, {
      type: 'mic-failed',
      run: 1,
      block: 'denied',
    })
    expect(staleFail).toBe(left)
  })

  it('shows why the mic did not open, and starts again from there', () => {
    const blocked = run([
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    ])
    expect(blocked).toMatchObject({ phase: 'blocked', block: 'denied' })

    expect(echoReducer(blocked, { type: 'start' })).toMatchObject({
      phase: 'starting',
      run: 2,
      block: null,
    })
  })

  it('goes call, response, between, and on to the next call', () => {
    const response = echoReducer(calling(), { type: 'heard' })
    expect(response.phase).toBe('response')
    const between = echoReducer(response, { type: 'phrase-end' })
    expect(between.phase).toBe('between')

    expect(echoReducer(between, { type: 'next' })).toMatchObject({
      phase: 'call',
      phrase: 1,
    })
  })

  it('goes to the result after the last phrase, and starts a new run from it', () => {
    const lastPhrase: EchoState = {
      ...initialEchoState(2),
      phase: 'between',
      phrase: 1,
      run: 1,
    }
    const result = echoReducer(lastPhrase, { type: 'next' })
    expect(result.phase).toBe('result')

    expect(echoReducer(result, { type: 'start' })).toMatchObject({
      phase: 'starting',
      phrase: -1,
      run: 2,
    })
  })

  it("goes back from the response to the same phrase's call to hear it again", () => {
    const response = echoReducer(calling(), { type: 'heard' })

    expect(echoReducer(response, { type: 'replay' })).toMatchObject({
      phase: 'call',
      phrase: 0,
    })
    expect(echoReducer(calling(), { type: 'replay' }).phase).toBe('call')
  })

  it.each(['stop', 'rest', 'leave'] as const)(
    'drops a run under way back to the intro on %s',
    (type) => {
      const response = echoReducer(calling(), { type: 'heard' })

      expect(echoReducer(response, { type })).toMatchObject({
        phase: 'intro',
        phrase: -1,
      })
    },
  )

  it('leaves the intro and the result as they are on stop, rest or leave', () => {
    const intro = initialEchoState(5)
    expect(echoReducer(intro, { type: 'leave' })).toBe(intro)
    const result: EchoState = { ...intro, phase: 'result', phrase: 4 }
    expect(echoReducer(result, { type: 'stop' })).toBe(result)
  })

  it('ignores events from the wrong phase', () => {
    const intro = initialEchoState(5)
    for (const type of ['heard', 'phrase-end', 'next', 'settled'] as const) {
      expect(echoReducer(intro, { type })).toBe(intro)
    }
    expect(echoReducer(calling(), { type: 'start' }).phase).toBe('call')
  })

  it('counts the phases of a run under way, the mic asked for or open', () => {
    const running = ['starting', 'settle', 'call', 'response', 'between']
    const still = ['intro', 'result', 'blocked']

    expect(running.map((p) => isRunPhase(p as EchoState['phase']))).toEqual(
      running.map(() => true),
    )
    expect(still.map((p) => isRunPhase(p as EchoState['phase']))).toEqual(
      still.map(() => false),
    )
  })
})
