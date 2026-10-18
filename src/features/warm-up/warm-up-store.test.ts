// ============================================================
// The Warm-up's store: the open stop, today's run kept, a new day
// ============================================================
//
// The run is read from storage on first use, so each case starts from a
// cleared storage and a dropped read (resetWarmUpForTests), and the app
// restarting is the same drop with storage kept.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StopResult } from '@/components/room-kit/routine-stop'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { WarmUpDay } from './routine'
import { nextStop, tally } from './routine'
import type { WarmUpRoomId } from './warm-up-plan'
import { canStartWarmUp, enterStop, leaveStop, openStop, resetWarmUpForTests, routineStopFor, skipNextStop, WARM_UP_TODAY_KEY, warmUpAgain, warmUpDay, } from './warm-up-store'

const ROOMS: readonly WarmUpRoomId[] = [
  EXERCISE_LIP_ROLL_BAY,
  EXERCISE_NG_SLIDES_BRIDGE,
  EXERCISE_LONG_NOTE_LANTERN,
  EXERCISE_ECHO_STARS,
]

const result = (
  id: WarmUpRoomId,
  line: string,
  settledNote: number | null = null,
): StopResult => ({ id, line, settledNote })

function states(day: WarmUpDay): string[] {
  return day.marks.map((mark) =>
    mark.state === 'done' ? mark.line : mark.state,
  )
}

function kept(): WarmUpDay | null {
  const raw = localStorage.getItem(WARM_UP_TODAY_KEY)
  return raw === null ? null : (JSON.parse(raw) as WarmUpDay)
}

/** Open stop `index` and finish it through the stop its room is handed. */
function sing(index: number, line: string, note: number | null = null): void {
  const id = ROOMS[index]!
  expect(enterStop(index)).toBe(true)
  routineStopFor(id)!.finish(result(id, line, note))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 18, 9, 0))
  localStorage.clear()
  resetWarmUpForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('today, before a stop opens', () => {
  it('shows a fresh run and keeps nothing until the first stop opens', () => {
    expect(states(warmUpDay())).toEqual(Array(5).fill('waiting'))
    expect(warmUpDay().date).toBe('2026-10-18')
    expect(kept()).toBeNull()
    expect(enterStop(0)).toBe(true)
    expect(kept()?.date).toBe('2026-10-18')
  })

  it('every build may start a warm-up', () => {
    expect(canStartWarmUp()).toBe(true)
  })
})

describe('the open stop', () => {
  it('is handed to its own room only, with its place and count', () => {
    expect(routineStopFor(EXERCISE_LIP_ROLL_BAY)).toBeUndefined()
    enterStop(0)
    expect(openStop()).toBe(0)
    const stop = routineStopFor(EXERCISE_LIP_ROLL_BAY)
    expect(stop).toMatchObject({ index: 0, count: 4, settledNote: null })
    expect(routineStopFor(EXERCISE_NG_SLIDES_BRIDGE)).toBeUndefined()
  })

  it('lights with its line when finished, closes, and keeps the run', () => {
    sing(0, '86% lit', 57)
    expect(openStop()).toBeNull()
    expect(states(warmUpDay())).toEqual([
      '86% lit',
      ...Array(4).fill('waiting'),
    ])
    expect(kept()).toEqual(warmUpDay())
  })

  it('hands the next room the note the last one started from', () => {
    sing(0, '86% lit', 57)
    enterStop(1)
    expect(routineStopFor(EXERCISE_NG_SLIDES_BRIDGE)).toMatchObject({
      index: 1,
      count: 4,
      settledNote: 57,
    })
  })

  it('"Skip stop" in its room marks it skipped and closes it', () => {
    enterStop(0)
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.skip()
    expect(openStop()).toBeNull()
    expect(states(warmUpDay())[0]).toBe('skipped')
    expect(nextStop(warmUpDay())).toBe(1)
  })

  it('drops when its room is left, and a late result from it does nothing', () => {
    sing(0, '86% lit')
    enterStop(1)
    const left = routineStopFor(EXERCISE_NG_SLIDES_BRIDGE)!
    leaveStop()
    left.finish(result(EXERCISE_NG_SLIDES_BRIDGE, '92% lit'))
    left.skip()
    expect(states(warmUpDay())).toEqual([
      '86% lit',
      ...Array(4).fill('waiting'),
    ])
    expect(openStop()).toBeNull()
  })

  it('cannot be finished by a stop opened before it, or by another room', () => {
    enterStop(0)
    const before = routineStopFor(EXERCISE_LIP_ROLL_BAY)!
    leaveStop()
    enterStop(1)
    before.finish(result(EXERCISE_LIP_ROLL_BAY, '86% lit'))
    routineStopFor(EXERCISE_NG_SLIDES_BRIDGE)!.finish(
      result(EXERCISE_ECHO_STARS, '8 of 9 on pitch'),
    )
    expect(states(warmUpDay())).toEqual(Array(5).fill('waiting'))
    expect(openStop()).toBe(1)
  })

  it('does not open for a skipped stop or the song', () => {
    enterStop(0)
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.skip()
    expect(enterStop(0)).toBe(false)
    expect(enterStop(4)).toBe(false)
    expect(openStop()).toBeNull()
  })
})

describe('the path', () => {
  it('Skip beside Next skips the next stop', () => {
    sing(0, '86% lit')
    skipNextStop()
    expect(states(warmUpDay()).slice(0, 3)).toEqual([
      '86% lit',
      'skipped',
      'waiting',
    ])
    expect(nextStop(warmUpDay())).toBe(2)
  })

  it('four stops sung: the end, warmed up; Warm up again starts over, still warmed up', () => {
    ;['86% lit', '92% lit', '12.6 s', '8 of 9 on pitch'].forEach((line, i) =>
      sing(i, line),
    )
    expect(warmUpDay().warmedUp).toBe(true)
    expect(tally(warmUpDay())).toEqual({ done: 4, skipped: 0, rooms: 4 })
    warmUpAgain()
    expect(states(warmUpDay())).toEqual(Array(5).fill('waiting'))
    expect(warmUpDay().warmedUp).toBe(true)
  })
})

describe('coming back', () => {
  it('the same day: the run as it was left; the stop in progress dropped', () => {
    sing(0, '86% lit')
    enterStop(1)
    resetWarmUpForTests() // the app goes, and comes back
    expect(openStop()).toBeNull()
    expect(routineStopFor(EXERCISE_NG_SLIDES_BRIDGE)).toBeUndefined()
    expect(tally(warmUpDay())).toEqual({ done: 1, skipped: 0, rooms: 4 })
    expect(nextStop(warmUpDay())).toBe(1)
  })

  it('the next day: a fresh run', () => {
    sing(0, '86% lit')
    vi.setSystemTime(new Date(2026, 9, 19, 0, 5))
    const day = warmUpDay()
    expect(day.date).toBe('2026-10-19')
    expect(states(day)).toEqual(Array(5).fill('waiting'))
    expect(day.warmedUp).toBe(false)
  })

  it('a stop opened before midnight finishes on its own run', () => {
    vi.setSystemTime(new Date(2026, 9, 18, 23, 59))
    enterStop(0)
    vi.setSystemTime(new Date(2026, 9, 19, 0, 1))
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.finish(
      result(EXERCISE_LIP_ROLL_BAY, '86% lit'),
    )
    expect(kept()?.date).toBe('2026-10-18')
    expect(kept()?.marks[0]).toEqual({ state: 'done', line: '86% lit' })
    expect(warmUpDay().date).toBe('2026-10-19')
    expect(tally(warmUpDay()).done).toBe(0)
  })

  it('a kept run this build cannot read counts as none', () => {
    localStorage.setItem(
      WARM_UP_TODAY_KEY,
      JSON.stringify({
        date: '2026-10-18',
        plan: { id: 'x', stops: [{ kind: 'room', id: 'vocal-fry' }] },
        marks: [{ state: 'done', line: '1 s' }],
        settledNote: null,
        warmedUp: true,
        lastActiveAt: 1,
      }),
    )
    resetWarmUpForTests()
    expect(states(warmUpDay())).toEqual(Array(5).fill('waiting'))
    expect(warmUpDay().warmedUp).toBe(false)
  })
})
