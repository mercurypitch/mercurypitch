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
import { TOO_SHORT_LINE } from '@/features/exercises/feedback'
import { activeTimerSeconds, CUSTOM_MAX_SEC, CUSTOM_MIN_SEC, CUSTOM_STEP_SEC, customTimerSeconds, MIN_SCORED_SECONDS, pinTimerForRun, releaseTimerPin, resetTimerPreference, scoreCapForEnd, setCustomTimerSeconds, setTimerMode, settleTimedRun, TIMER_PRESETS, TIMER_STORAGE_KEY, timerMode, tooShortToScore, } from '@/features/exercises/timer-preference'
import type { ExerciseResult } from '@/features/exercises/types'
import { runStoppedEarly } from '@/features/exercises/types'

describe('run-length preference', () => {
  beforeEach(() => {
    resetTimerPreference()
  })

  afterEach(() => {
    resetTimerPreference()
  })

  it('opens on ten seconds rather than on Manual', () => {
    // Five was over before a steady tone settled — the singer's own words:
    // by the time they hit the note, half the run was gone. Ten gives the
    // held-note drills a real run and the daily routine real minutes.
    expect(timerMode()).toBe(10)
    expect(activeTimerSeconds()).toBe(10)
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

describe('the length of a run in progress', () => {
  // The timer is chosen between runs, but a settings sync can land during
  // one. The run keeps the length it started with; the change is the next
  // run's.
  afterEach(() => {
    resetTimerPreference()
  })

  it('holds a run to the length it started with', () => {
    setTimerMode(10)
    const pin = pinTimerForRun()

    setTimerMode(30)
    expect(activeTimerSeconds()).toBe(10)
    setTimerMode('manual')
    expect(activeTimerSeconds()).toBe(10)

    releaseTimerPin(pin)
    expect(activeTimerSeconds()).toBeNull()
  })

  it('holds a Manual run to Manual', () => {
    setTimerMode('manual')
    const pin = pinTimerForRun()

    setTimerMode(5)
    expect(activeTimerSeconds()).toBeNull()

    releaseTimerPin(pin)
    expect(activeTimerSeconds()).toBe(5)
  })

  it('lets a released run leave the next run its own pin', () => {
    setTimerMode(10)
    const first = pinTimerForRun()
    setTimerMode(15)
    const second = pinTimerForRun()

    // The first run's shell cleans up after the second run has started.
    releaseTimerPin(first)
    setTimerMode(30)
    expect(activeTimerSeconds()).toBe(15)

    releaseTimerPin(second)
    expect(activeTimerSeconds()).toBe(30)
  })
})

describe('what a timed run scores for how it ended', () => {
  const graded = (score: number): ExerciseResult => ({
    type: 'long-note',
    score,
    metrics: { sungSec: 4 },
    completedAt: 0,
  })

  afterEach(() => {
    resetTimerPreference()
  })

  it('asks a Manual run for as much singing as the shortest timer', () => {
    expect(MIN_SCORED_SECONDS).toBe(Math.min(...TIMER_PRESETS))
    expect(MIN_SCORED_SECONDS).toBe(CUSTOM_MIN_SEC)
    // The line says the number the rule uses.
    expect(TOO_SHORT_LINE).toContain(`${MIN_SCORED_SECONDS} seconds`)

    setTimerMode('manual')
    expect(tooShortToScore(4.9)).toBe(true)
    expect(tooShortToScore(5)).toBe(false)
    setTimerMode(10)
    expect(tooShortToScore(1)).toBe(false)
  })

  it('caps a Stop in the last second at its share of the length', () => {
    setTimerMode(5)
    expect(scoreCapForEnd('stop', 4_000)).toBe(80)
    expect(scoreCapForEnd('stop', 4_990)).toBe(99)
    expect(scoreCapForEnd('stop', 5_050)).toBe(100)
    expect(scoreCapForEnd('timer', 4_000)).toBe(100)
    setTimerMode(30)
    expect(scoreCapForEnd('stop', 29_000)).toBe(96)
    setTimerMode('manual')
    expect(scoreCapForEnd('stop', 1_000)).toBe(100)
  })

  it('caps a whole run stopped in its last second, and leaves a marked one its grade', () => {
    setTimerMode(5)
    const lastSecond = settleTimedRun(graded(97), 'stop', 4_000, 4)
    const early = settleTimedRun(graded(97), 'stop', 2_000, 2)
    const timedOut = settleTimedRun(graded(97), 'timer', 5_000, 5)

    expect(runStoppedEarly(lastSecond.metrics)).toBe(false)
    expect(lastSecond.score).toBe(80)
    expect(runStoppedEarly(early.metrics)).toBe(true)
    expect(early.score).toBe(97)
    expect(early.metrics.tooShort).toBeUndefined()
    expect(timedOut.score).toBe(97)
    expect(runStoppedEarly(timedOut.metrics)).toBe(false)
  })

  it('marks a Manual run under five sung seconds as too short, whatever its grade', () => {
    setTimerMode('manual')
    const short = settleTimedRun(graded(85), 'stop', 9_000, 1)
    const long = settleTimedRun(graded(88), 'stop', 6_000, 6)

    expect(runStoppedEarly(short.metrics)).toBe(true)
    expect(short.metrics.tooShort).toBe(1)
    expect(runStoppedEarly(long.metrics)).toBe(false)
    expect(long.metrics.tooShort).toBeUndefined()
    expect(long.score).toBe(88)
  })
})
