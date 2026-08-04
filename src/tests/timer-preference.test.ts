// ============================================================
// The run-length preference
// ============================================================
//
// Two things here are behaviour rather than plumbing.
//
// The default is a duration, not "Manual". A routine segment that waits for
// the singer to press Stop does not tick off, and a run that ends on a reflex
// was scored on a length nobody chose.
//
// And Custom keeps its own value while a preset is selected. Somebody who
// dialled in 45 seconds, tried the 10-second preset and went back to Custom is
// asking for their 45 back, not for whatever the slider defaults to.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { activeTimerSeconds, CUSTOM_MAX_SEC, CUSTOM_MIN_SEC, CUSTOM_STEP_SEC, customTimerSeconds, resetTimerPreference, setCustomTimerSeconds, setTimerMode, TIMER_PRESETS, TIMER_STORAGE_KEY, timerMode, } from '@/features/exercises/timer-preference'

describe('run-length preference', () => {
  beforeEach(() => {
    resetTimerPreference()
  })

  afterEach(() => {
    resetTimerPreference()
  })

  it('opens on a duration rather than on Manual', () => {
    expect(timerMode()).toBe(5)
    expect(activeTimerSeconds()).toBe(5)
  })

  it('stores under a key the settings sync will actually carry', () => {
    // settings-service syncs by prefix. A key without it is device-local, and
    // nothing fails loudly when that happens — the preference just quietly
    // stops following the singer between devices.
    expect(TIMER_STORAGE_KEY.startsWith('pitchperfect_')).toBe(true)
  })

  it('offers a rung between five and fifteen seconds', () => {
    expect(TIMER_PRESETS).toContain(10)
    // The ladder has to climb, or the pills read in a random order.
    const climbing = [...TIMER_PRESETS].sort((a, b) => a - b)
    expect([...TIMER_PRESETS]).toEqual(climbing)
  })

  it('reports no length at all in manual mode', () => {
    setTimerMode('manual')
    expect(activeTimerSeconds()).toBeNull()
  })

  it('keeps the custom length while a preset is selected', () => {
    setCustomTimerSeconds(45)
    setTimerMode(10)
    expect(activeTimerSeconds()).toBe(10)

    setTimerMode('custom')
    expect(activeTimerSeconds()).toBe(45)
  })

  it('holds the custom length inside the slider it is set with', () => {
    setCustomTimerSeconds(CUSTOM_MAX_SEC + 500)
    expect(customTimerSeconds()).toBe(CUSTOM_MAX_SEC)

    setCustomTimerSeconds(0)
    expect(customTimerSeconds()).toBe(CUSTOM_MIN_SEC)

    setCustomTimerSeconds(-30)
    expect(customTimerSeconds()).toBe(CUSTOM_MIN_SEC)
  })

  it('snaps a custom length onto the slider step', () => {
    setCustomTimerSeconds(47)
    expect(customTimerSeconds() % CUSTOM_STEP_SEC).toBe(0)
    expect(customTimerSeconds()).toBe(45)
  })
})
