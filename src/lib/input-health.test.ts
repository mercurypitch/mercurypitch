import { beforeEach, describe, expect, it } from 'vitest'
import { armInputHealth, disarmInputHealth, initialInputHealth, observeInputLevel, SIGNAL_FLOOR_RMS, SILENCE_GRACE_MS, } from './input-health'
import { micLevelFraction, publishMicLevel, readMicLevel, resetMicLevel, rmsToDb, } from './mic-level'

/** A level comfortably above the floor — an ordinary sung note. */
const SINGING = 0.08
/** A level below the floor — a muted device's numerical noise. */
const DEAD = 0.00005

describe('input-health', () => {
  it('stays unknown while disarmed, however loud the input', () => {
    const state = observeInputLevel(initialInputHealth(), SINGING, 10_000)
    expect(state.status).toBe('unknown')
    expect(state.peakRms).toBe(0)
  })

  it('goes healthy on the first frame above the floor', () => {
    const armed = armInputHealth(0)
    const heard = observeInputLevel(armed, SIGNAL_FLOOR_RMS, 100)
    expect(heard.status).toBe('healthy')
  })

  it('stays unknown inside the grace period', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, DEAD, SILENCE_GRACE_MS - 1)
    expect(state.status).toBe('unknown')
  })

  it('goes silent once the grace period elapses with no signal', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, DEAD, SILENCE_GRACE_MS)
    expect(state.status).toBe('silent')
  })

  it('keeps healthy through a rest longer than the grace period', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, SINGING, 100)
    expect(state.status).toBe('healthy')
    state = observeInputLevel(state, 0, 100 + SILENCE_GRACE_MS * 3)
    expect(state.status).toBe('healthy')
  })

  it('re-arming forgets the previous run', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, SINGING, 100)
    expect(state.status).toBe('healthy')

    state = armInputHealth(200)
    expect(state.status).toBe('unknown')
    expect(state.peakRms).toBe(0)

    state = observeInputLevel(state, DEAD, 200 + SILENCE_GRACE_MS)
    expect(state.status).toBe('silent')
  })

  it('recovers from silent when the singer finally arrives', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, DEAD, SILENCE_GRACE_MS)
    expect(state.status).toBe('silent')
    state = observeInputLevel(state, SINGING, SILENCE_GRACE_MS + 500)
    expect(state.status).toBe('healthy')
  })

  it('disarming clears the state', () => {
    let state = armInputHealth(0)
    state = observeInputLevel(state, SINGING, 100)
    expect(disarmInputHealth()).toEqual(initialInputHealth())
    expect(state.status).toBe('healthy')
  })

  // Solid stores bail out of a re-render when the value is identical, so an
  // unchanged frame must not allocate a new object.
  it('returns the same object when nothing changed', () => {
    const armed = armInputHealth(0)
    const first = observeInputLevel(armed, DEAD, 10)
    const second = observeInputLevel(first, 0, 20)
    expect(second).toBe(first)
  })
})

describe('mic-level', () => {
  beforeEach(() => {
    resetMicLevel()
  })

  it('reads back what was published', () => {
    publishMicLevel(0.42, 1000)
    expect(readMicLevel(1000)).toBe(0.42)
  })

  it('reads 0 before anything is published', () => {
    expect(readMicLevel(0)).toBe(0)
  })

  it('goes stale when the capture loop stops publishing', () => {
    publishMicLevel(0.42, 1000)
    expect(readMicLevel(1300)).toBe(0.42)
    expect(readMicLevel(2000)).toBe(0)
  })

  it('drops non-finite and negative levels rather than fabricating silence', () => {
    publishMicLevel(0.42, 1000)
    publishMicLevel(Number.NaN, 1010)
    publishMicLevel(-1, 1020)
    expect(readMicLevel(1030)).toBe(0.42)
  })

  it('maps silence to the meter floor and full scale to the top', () => {
    expect(rmsToDb(0)).toBe(-60)
    expect(micLevelFraction(0)).toBe(0)
    expect(micLevelFraction(1)).toBe(1)
  })

  it('spends the meter width where the voice lives', () => {
    // -20 dBFS is a comfortable sung note; on a linear scale it would sit at
    // a tenth of the bar, on the dB scale it sits two thirds up.
    expect(micLevelFraction(0.1)).toBeCloseTo(2 / 3, 5)
  })
})
