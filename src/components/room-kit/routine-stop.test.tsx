// ============================================================
// RoutineStop: the chip and the held result of a room in warm-up mode
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import type { RoutineStop, StopResult } from './routine-stop'
import { createRoutineHold, ROUTINE_RESULT_HOLD_MS, ROUTINE_TAP_GRACE_MS, routineChip, } from './routine-stop'

const RESULT: StopResult = {
  id: EXERCISE_LIP_ROLL_BAY,
  line: '86% lit',
  settledNote: 50,
}
/** The room's result sequence, settled this long after it shows, ms. */
const SETTLE_MS = 1200

function fakeStop(): { stop: RoutineStop; finished: StopResult[] } {
  const finished: StopResult[] = []
  const stop: RoutineStop = {
    index: 0,
    count: 4,
    settledNote: null,
    finish: (result) => finished.push(result),
    skip: () => undefined,
  }
  return { stop, finished }
}

/** A hold over a room whose result the test shows and hides. */
function holdOver(result: () => StopResult | null = () => RESULT) {
  const { stop, finished } = fakeStop()
  const [atResult, setAtResult] = createSignal(false)
  let dispose = (): void => undefined
  const hold = createRoot((done) => {
    dispose = done
    return createRoutineHold({
      routine: { stop, settleMs: SETTLE_MS, result },
      atResult,
    })
  })
  return { hold, finished, setAtResult, dispose }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('routineChip', () => {
  it('counts the stops from one', () => {
    expect(routineChip({ index: 0, count: 4 })).toBe('Warm-up 1 of 4')
    expect(routineChip({ index: 3, count: 4 })).toBe('Warm-up 4 of 4')
    expect(routineChip({ index: 1, count: 6 })).toBe('Warm-up 2 of 6')
  })
})

describe('createRoutineHold', () => {
  it('hands the result on once, when the hold ends after the sequence settles', () => {
    const { finished, setAtResult, dispose } = holdOver()

    vi.advanceTimersByTime(10_000)
    expect(finished).toEqual([])
    setAtResult(true)
    vi.advanceTimersByTime(SETTLE_MS + ROUTINE_RESULT_HOLD_MS - 1)
    expect(finished).toEqual([])
    vi.advanceTimersByTime(1)
    expect(finished).toEqual([RESULT])
    vi.advanceTimersByTime(10_000)
    expect(finished).toEqual([RESULT])
    dispose()
  })

  it('goes on at a tap, but not at the one that ended the take', () => {
    const { hold, finished, setAtResult, dispose } = holdOver()

    setAtResult(true)
    hold.tap()
    vi.advanceTimersByTime(ROUTINE_TAP_GRACE_MS - 1)
    hold.tap()
    expect(finished).toEqual([])
    vi.advanceTimersByTime(1)
    hold.tap()
    expect(finished).toEqual([RESULT])
    hold.tap()
    vi.advanceTimersByTime(10_000)
    expect(finished).toEqual([RESULT])
    dispose()
  })

  it('hands nothing on without a result, or once the result has gone', () => {
    let result: StopResult | null = null
    const { hold, finished, setAtResult, dispose } = holdOver(() => result)

    setAtResult(true)
    vi.advanceTimersByTime(SETTLE_MS + ROUTINE_RESULT_HOLD_MS)
    expect(finished).toEqual([])
    result = RESULT
    setAtResult(false)
    vi.advanceTimersByTime(10_000)
    hold.tap()
    expect(finished).toEqual([])
    dispose()
  })

  it('hands nothing on from a room left before the hold ended', () => {
    const { finished, setAtResult, dispose } = holdOver()

    setAtResult(true)
    vi.advanceTimersByTime(SETTLE_MS)
    dispose()
    vi.advanceTimersByTime(10_000)
    expect(finished).toEqual([])
  })
})
