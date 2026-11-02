import { describe, expect, it } from 'vitest'
import { INITIAL_LEAP_STATE, isRunPhase, leapReducer, liveRound, } from './leap-machine'
import type { LeapRound } from './leap-round'

const ROUND: LeapRound = {
  index: 0,
  kind: { size: 7, up: true },
  from: 57,
  to: 64,
}

describe("Leap's machine, the demo's moves", () => {
  it("calls the demo's one leap, and its own steps move it as a run's", () => {
    const called = leapReducer(INITIAL_LEAP_STATE, {
      type: 'demo',
      round: ROUND,
    })
    expect(called).toMatchObject({ phase: 'call', rounds: [ROUND], current: 0 })
    expect(liveRound(called)).toEqual(ROUND)
    const turn = leapReducer(called, { type: 'turn' })
    expect(turn.phase).toBe('sing')
    const missed = leapReducer(turn, {
      type: 'outcome',
      outcome: {
        round: ROUND,
        landed: false,
        cents: null,
        seconds: null,
        matched: true,
        voiced: true,
        short: true,
        heardAgain: false,
      },
    })
    expect(missed.phase).toBe('missed')
    expect(isRunPhase(missed.phase)).toBe(true)
  })

  it('goes back to rest with no leap, keeping the run count', () => {
    const run = leapReducer(INITIAL_LEAP_STATE, {
      type: 'start',
      rounds: [ROUND],
    })
    const called = leapReducer(run, { type: 'demo', round: ROUND })
    expect(called.run).toBe(run.run)
    const rest = leapReducer(called, { type: 'demo', round: null })
    expect(rest).toEqual({ ...INITIAL_LEAP_STATE, run: run.run })
  })
})
