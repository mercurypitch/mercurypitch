// ============================================================
// Glass session reducer — phase ordering, calibration retries,
// the rep loop and the shatter path.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { RepMetrics } from './metrics'
import type { GlassEvent, GlassSessionState } from './session'
import { initialSessionState, reduceSession } from './session'

const metrics = (rep: number): RepMetrics => ({
  rep,
  meanAbsCents: 40,
  bestLockSec: 1.2,
  inBandPct: 0.5,
  peakResonance: 0.8,
})

function play(
  events: GlassEvent[],
  from = initialSessionState(),
): GlassSessionState {
  return events.reduce(reduceSession, from)
}

const calibrated: GlassEvent = {
  type: 'calibrate-done',
  ok: true,
  ceilingMidi: 69,
  targetMidi: 67,
  fallbackTargetMidi: 64,
}

describe('reduceSession', () => {
  it('walks the happy path to a rep-2 shatter', () => {
    const state = play([
      { type: 'start' },
      { type: 'mic-granted' },
      calibrated,
      { type: 'announce-done' },
      { type: 'sing-done', metrics: metrics(1) },
      { type: 'playback-done' },
      { type: 'gap-done' },
      { type: 'shattered', metrics: metrics(2) },
      { type: 'shatter-done' },
    ])
    expect(state.phase).toBe('results')
    expect(state.rep).toBe(2)
    expect(state.shatterRep).toBe(2)
    expect(state.repMetrics).toHaveLength(2)
    expect(state.targetMidi).toBe(67)
    expect(state.usedFallback).toBe(false)
  })

  it('keeps looping reps while the glass holds', () => {
    let state = play([
      { type: 'start' },
      { type: 'mic-granted' },
      calibrated,
      { type: 'announce-done' },
    ])
    for (let rep = 1; rep <= 4; rep++) {
      expect(state.phase).toBe('sing')
      expect(state.rep).toBe(rep)
      state = play(
        [
          { type: 'sing-done', metrics: metrics(rep) },
          { type: 'playback-done' },
          { type: 'gap-done' },
        ],
        state,
      )
    }
    expect(state.rep).toBe(5)
    expect(state.shatterRep).toBeNull()
    expect(state.repMetrics).toHaveLength(4)
  })

  it('retries a failed calibration once, then uses the median fallback', () => {
    const failed: GlassEvent = {
      type: 'calibrate-done',
      ok: false,
      ceilingMidi: null,
      targetMidi: null,
      fallbackTargetMidi: 62,
    }
    let state = play([{ type: 'start' }, { type: 'mic-granted' }, failed])
    expect(state.phase).toBe('calibrate') // one more try
    state = reduceSession(state, failed)
    expect(state.phase).toBe('announce')
    expect(state.targetMidi).toBe(62)
    expect(state.usedFallback).toBe(true)
  })

  it('fails calibration terminally when even the fallback is missing', () => {
    const dead: GlassEvent = {
      type: 'calibrate-done',
      ok: false,
      ceilingMidi: null,
      targetMidi: null,
      fallbackTargetMidi: null,
    }
    const state = play([{ type: 'start' }, { type: 'mic-granted' }, dead, dead])
    expect(state.phase).toBe('calibrate-failed')
  })

  it('ends the session early with the glass still standing', () => {
    const state = play([
      { type: 'start' },
      { type: 'mic-granted' },
      calibrated,
      { type: 'announce-done' },
      { type: 'sing-done', metrics: metrics(1) },
      { type: 'end-session' },
    ])
    expect(state.phase).toBe('results')
    expect(state.shatterRep).toBeNull()
    expect(state.repMetrics).toHaveLength(1)
  })

  it('recovers from mic-denied when the singer retries and grants', () => {
    let state = play([{ type: 'start' }, { type: 'mic-denied' }])
    expect(state.phase).toBe('mic-denied')
    // "Try again" → start() re-requests, then a granted prompt proceeds.
    state = reduceSession(state, { type: 'start' })
    expect(state.phase).toBe('mic')
    state = reduceSession(state, { type: 'mic-granted' })
    expect(state.phase).toBe('calibrate')
  })

  it('ignores events that arrive in the wrong phase', () => {
    const idle = initialSessionState()
    expect(
      reduceSession(idle, { type: 'sing-done', metrics: metrics(1) }),
    ).toBe(idle)
    expect(reduceSession(idle, { type: 'gap-done' })).toBe(idle)
    const mic = reduceSession(idle, { type: 'start' })
    expect(reduceSession(mic, { type: 'announce-done' })).toBe(mic)
  })

  it('resets to the initial state from anywhere', () => {
    const state = play([
      { type: 'start' },
      { type: 'mic-granted' },
      calibrated,
      { type: 'announce-done' },
      { type: 'reset' },
    ])
    expect(state).toEqual(initialSessionState())
  })
})
