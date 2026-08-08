// ============================================================
// Practice Timer Store Tests
// ============================================================
//
// The tick is a pure function of (mic open, phase, elapsed), so none of this
// needs a device or a real clock — it just calls the tick the right number of
// times. Intervals are set to their minimums to keep the loops short.

import { beforeEach, describe, expect, it } from 'vitest'
import { notifications, setNotifications } from '@/stores/notifications-store'
import { BREAK_MIN_RANGE, breakIntervalMin, phaseElapsedMs, phaseRemainingMs, PRACTICE_MIN_RANGE, practiceIntervalMin, practicePhase, practiceTimerTick, practiceTimerVisible, resetPracticeTimer, setBreakIntervalMin, setPracticeIntervalMin, setPracticeTimerEnabled, skipPracticeTimerPhase, } from '@/stores/practice-timer-store'

const SECOND = 1000

/** Run `seconds` ticks with the mic in one state. */
function tickFor(seconds: number, micOpen: boolean): void {
  for (let i = 0; i < seconds; i++) practiceTimerTick(micOpen)
}

describe('Practice Timer Store', () => {
  beforeEach(() => {
    setPracticeTimerEnabled(false)
    setPracticeIntervalMin(PRACTICE_MIN_RANGE.min)
    setBreakIntervalMin(BREAK_MIN_RANGE.min)
    resetPracticeTimer()
    setNotifications([])
  })

  describe('while disabled', () => {
    it('ignores ticks entirely', () => {
      tickFor(60, true)
      expect(phaseElapsedMs()).toBe(0)
      expect(practicePhase()).toBe('practice')
    })

    it('has nothing to show', () => {
      expect(practiceTimerVisible()).toBe(false)
    })
  })

  describe('practice phase', () => {
    beforeEach(() => {
      setPracticeTimerEnabled(true)
    })

    it('counts singing time', () => {
      tickFor(3, true)
      expect(phaseElapsedMs()).toBe(3 * SECOND)
    })

    it('stands still while the mic is closed', () => {
      tickFor(3, true)
      tickFor(30, false)
      expect(phaseElapsedMs()).toBe(3 * SECOND)
    })

    it('appears only once a second of singing has accrued', () => {
      expect(practiceTimerVisible()).toBe(false)
      tickFor(1, true)
      expect(practiceTimerVisible()).toBe(true)
    })

    it('counts down toward the configured interval', () => {
      tickFor(60, true)
      expect(phaseRemainingMs()).toBe(
        PRACTICE_MIN_RANGE.min * 60 * SECOND - 60 * SECOND,
      )
    })

    it('enters the break when the interval is reached', () => {
      tickFor(PRACTICE_MIN_RANGE.min * 60, true)
      expect(practicePhase()).toBe('break')
      expect(phaseElapsedMs()).toBe(0)
    })

    it('warns the singer when the break becomes due', () => {
      tickFor(PRACTICE_MIN_RANGE.min * 60, true)
      const [notif] = notifications()
      expect(notif?.type).toBe('warning')
      expect(notif?.message).toContain(`${PRACTICE_MIN_RANGE.min} minutes`)
    })
  })

  describe('break phase', () => {
    beforeEach(() => {
      setPracticeTimerEnabled(true)
      skipPracticeTimerPhase()
      setNotifications([])
    })

    it('is always visible, even at zero elapsed', () => {
      expect(practicePhase()).toBe('break')
      expect(practiceTimerVisible()).toBe(true)
    })

    it('counts down only while the mic is closed', () => {
      tickFor(30, true)
      expect(phaseElapsedMs()).toBe(0)
      tickFor(30, false)
      expect(phaseElapsedMs()).toBe(30 * SECOND)
    })

    it('returns to practice when the break is served', () => {
      tickFor(BREAK_MIN_RANGE.min * 60, false)
      expect(practicePhase()).toBe('practice')
      expect(phaseElapsedMs()).toBe(0)
    })

    it('says so when the break is over', () => {
      tickFor(BREAK_MIN_RANGE.min * 60, false)
      const [notif] = notifications()
      expect(notif?.type).toBe('success')
      expect(notif?.message).toContain('Break over')
    })

    it('never stacks phase toasts', () => {
      tickFor(BREAK_MIN_RANGE.min * 60, false)
      tickFor(PRACTICE_MIN_RANGE.min * 60, true)
      expect(notifications()).toHaveLength(1)
    })
  })

  describe('skipPracticeTimerPhase', () => {
    beforeEach(() => {
      setPracticeTimerEnabled(true)
    })

    it('takes the break early and drops the elapsed count', () => {
      tickFor(10, true)
      skipPracticeTimerPhase()
      expect(practicePhase()).toBe('break')
      expect(phaseElapsedMs()).toBe(0)
    })

    it('ends a break early', () => {
      skipPracticeTimerPhase()
      tickFor(10, false)
      skipPracticeTimerPhase()
      expect(practicePhase()).toBe('practice')
      expect(phaseElapsedMs()).toBe(0)
    })

    it('says nothing — the user just asked for it', () => {
      skipPracticeTimerPhase()
      expect(notifications()).toHaveLength(0)
    })
  })

  describe('interval settings', () => {
    it('clamps the practice interval to its range', () => {
      setPracticeIntervalMin(1)
      expect(practiceIntervalMin()).toBe(PRACTICE_MIN_RANGE.min)
      setPracticeIntervalMin(9999)
      expect(practiceIntervalMin()).toBe(PRACTICE_MIN_RANGE.max)
    })

    it('clamps the break interval to its range', () => {
      setBreakIntervalMin(0)
      expect(breakIntervalMin()).toBe(BREAK_MIN_RANGE.min)
      setBreakIntervalMin(9999)
      expect(breakIntervalMin()).toBe(BREAK_MIN_RANGE.max)
    })

    it('rounds a fractional interval rather than storing it', () => {
      setPracticeIntervalMin(20.6)
      expect(practiceIntervalMin()).toBe(21)
    })
  })

  describe('turning the timer off', () => {
    it('throws away the phase in progress', () => {
      setPracticeTimerEnabled(true)
      skipPracticeTimerPhase()
      tickFor(10, false)

      setPracticeTimerEnabled(false)
      expect(practicePhase()).toBe('practice')
      expect(phaseElapsedMs()).toBe(0)
      expect(practiceTimerVisible()).toBe(false)
    })
  })
})
