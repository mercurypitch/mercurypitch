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
import { applyPersistedValue } from '@/lib/storage'
import { WARM_UP_DAYS_KEY } from '@/lib/warm-up-days'
import type { UnlockItem } from '@/stores/notifications-store'
import { notifications, resetNotifications, setNotificationPresenter, showNotification, } from '@/stores/notifications-store'
import type { WarmUpDay } from './routine'
import { nextStop, tally } from './routine'
import type { WarmUpRoomId } from './warm-up-plan'
import { canStartWarmUp, claimPathUnlocks, enterStop, firstPathOpenToday, leavePath, leaveStop, nextWarmUpRoom, openStop, resetWarmUpForTests, routineStopFor, routineUnlocks, skipNextStop, WARM_UP_OPENED_KEY, WARM_UP_TODAY_KEY, warmedUpToday, warmUpAgain, warmUpDay, warmUpDays, warmUpLastMove, warmUpWeek, } from './warm-up-store'

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

/** The synced days as stored, or null before any were written. */
function keptDays(): unknown {
  const raw = localStorage.getItem(WARM_UP_DAYS_KEY)
  return raw === null ? null : JSON.parse(raw)
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

describe("the last move, for the path's card", () => {
  it('is the stop just finished, and none once the next one opens', () => {
    sing(0, '86% lit')
    expect(warmUpLastMove()).toEqual({ index: 0, state: 'done' })
    expect(enterStop(1)).toBe(true)
    expect(warmUpLastMove()).toBeNull()
  })

  it('is the stop skipped, in its room or beside Next', () => {
    expect(enterStop(0)).toBe(true)
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.skip()
    expect(warmUpLastMove()).toEqual({ index: 0, state: 'skipped' })
    skipNextStop()
    expect(warmUpLastMove()).toEqual({ index: 1, state: 'skipped' })
  })

  it('stays none when a room is left before its result', () => {
    sing(0, '86% lit')
    expect(enterStop(1)).toBe(true)
    leaveStop()
    expect(warmUpLastMove()).toBeNull()
  })

  it('goes with the path, with Warm up again and with a restart; the run stays', () => {
    sing(0, '86% lit')
    leavePath()
    expect(warmUpLastMove()).toBeNull()

    sing(1, '92% lit')
    sing(2, '12.6 s')
    sing(3, '8 of 9 on pitch')
    warmUpAgain()
    expect(warmUpLastMove()).toBeNull()

    sing(0, '80% lit')
    resetWarmUpForTests()
    expect(warmUpLastMove()).toBeNull()
    expect(states(warmUpDay())[0]).toBe('80% lit')
  })
})

describe('what the routine unlocked', () => {
  const STEADY: UnlockItem = {
    kind: 'badge',
    name: 'Steady Hold',
    icon: 'leaf',
  }
  const WEEK: UnlockItem = { kind: 'achievement', name: 'First Week' }
  const grant = (item: UnlockItem): void => {
    showNotification(`Unlocked: ${item.name}`, 'success', { unlock: item })
  }

  beforeEach(() => {
    resetNotifications()
    setNotificationPresenter('pill')
  })

  afterEach(() => {
    resetWarmUpForTests()
    resetNotifications()
  })

  it("comes to the path from a stop's room, and raises no notice", () => {
    expect(enterStop(0)).toBe(true)
    grant(STEADY)
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.finish(
      result(EXERCISE_LIP_ROLL_BAY, '86% lit'),
    )
    expect(routineUnlocks()).toEqual([STEADY])
    expect(notifications()).toHaveLength(0)
  })

  it('is held by the path while it is up, and let go as it is left', () => {
    const release = claimPathUnlocks()
    grant(WEEK)
    expect(routineUnlocks()).toEqual([WEEK])
    expect(notifications()).toHaveLength(0)

    release()
    leavePath()
    expect(routineUnlocks()).toEqual([])
    grant(STEADY)
    expect(notifications().map((n) => n.message)).toEqual([
      'New badge: Steady Hold',
    ])
  })

  it('is no longer claimed once a room is left unfinished', () => {
    expect(enterStop(0)).toBe(true)
    leaveStop()
    grant(STEADY)
    expect(routineUnlocks()).toEqual([])
    expect(notifications()).toHaveLength(1)
  })
})

describe('the picker card and the tap that opens the Warm-up', () => {
  it('counts today once the end is reached with a stop finished', () => {
    sing(0, '86% lit')
    skipNextStop()
    sing(2, '12.6 s')
    expect(warmedUpToday()).toBe(false)
    sing(3, '8 of 9 on pitch')
    expect(warmedUpToday()).toBe(true)
  })

  it('names the room the path opens next, and none at the end', () => {
    expect(nextWarmUpRoom()).toBe(EXERCISE_LIP_ROLL_BAY)
    sing(0, '86% lit')
    skipNextStop()
    expect(nextWarmUpRoom()).toBe(EXERCISE_LONG_NOTE_LANTERN)
    sing(2, '12.6 s')
    sing(3, '8 of 9 on pitch')
    expect(nextWarmUpRoom()).toBeNull()
  })
})

describe('the days warmed up (N5)', () => {
  it('joins the synced days once the end counts the day, and once only', () => {
    sing(0, '86% lit')
    sing(1, '92% lit')
    sing(2, '12.6 s')
    expect(keptDays()).toBeNull()
    sing(3, '8 of 9 on pitch')
    expect(keptDays()).toEqual(['2026-10-18'])
    const written = localStorage.getItem(WARM_UP_DAYS_KEY)
    warmUpAgain()
    sing(0, '90% lit')
    expect(localStorage.getItem(WARM_UP_DAYS_KEY)).toBe(written)
  })

  it('counts a day reached by Skip beside Next, and none with every stop skipped', () => {
    for (let i = 0; i < 4; i += 1) skipNextStop()
    expect(keptDays()).toBeNull()
    sing(0, '86% lit')
    for (let i = 0; i < 3; i += 1) skipNextStop()
    expect(keptDays()).toEqual(['2026-10-18'])
  })

  it('writes nothing on a read', () => {
    expect(warmedUpToday()).toBe(false)
    expect(warmUpWeek()).toBeNull()
    expect(warmUpDays()).toEqual([])
    expect(keptDays()).toBeNull()
  })

  it("says today is warmed up when another device's run counted it", () => {
    localStorage.setItem(WARM_UP_DAYS_KEY, JSON.stringify(['2026-10-18']))
    expect(warmedUpToday()).toBe(true)
    // This device's run is its own: the path still starts fresh here.
    expect(warmUpDay().warmedUp).toBe(false)
    expect(warmUpWeek()?.find((dot) => dot.today)).toEqual({
      day: '2026-10-18',
      warmed: true,
      today: true,
    })
  })

  it('takes a pulled day into the card at once', () => {
    expect(warmedUpToday()).toBe(false)
    applyPersistedValue(WARM_UP_DAYS_KEY, JSON.stringify(['2026-10-18']))
    expect(warmedUpToday()).toBe(true)
  })

  it("counts today's run before its date has landed in the synced days", () => {
    for (const i of [0, 1, 2, 3]) sing(i, 'done')
    // The settings sync set the days back (another account's copy, say):
    // this device's run still counts today.
    applyPersistedValue(WARM_UP_DAYS_KEY, '[]')
    expect(warmedUpToday()).toBe(true)
    expect(warmUpDays()).toEqual(['2026-10-18'])
  })

  it('shows the week across a month boundary, Monday first, today ringed', () => {
    // Thursday 1 Oct 2026; Monday 28 Sep was warmed up, Sunday 27 Sep is
    // the week before.
    vi.setSystemTime(new Date(2026, 9, 1, 9, 0))
    localStorage.setItem(
      WARM_UP_DAYS_KEY,
      JSON.stringify(['2026-09-27', '2026-09-28']),
    )
    const week = warmUpWeek()
    expect(week?.map((dot) => dot.day)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(week?.filter((dot) => dot.warmed).map((dot) => dot.day)).toEqual([
      '2026-09-28',
    ])
    expect(week?.find((dot) => dot.today)?.day).toBe('2026-10-01')
    expect(warmedUpToday()).toBe(false)
  })
})

describe("the path's first open of the day (§5.2, §10)", () => {
  it('is the first open today, once: later opens that day arrive settled', () => {
    expect(firstPathOpenToday()).toBe(true)
    expect(firstPathOpenToday()).toBe(false)
    expect(firstPathOpenToday()).toBe(false)
  })

  it('is kept on this device, so a restart the same day does not draw it in again', () => {
    expect(firstPathOpenToday()).toBe(true)
    expect(localStorage.getItem(WARM_UP_OPENED_KEY)).toBe('2026-10-18')
    resetWarmUpForTests()
    expect(firstPathOpenToday()).toBe(false)
  })

  it("a new day opens fresh, at the singer's midnight", () => {
    expect(firstPathOpenToday()).toBe(true)
    vi.setSystemTime(new Date(2026, 9, 18, 23, 59))
    expect(firstPathOpenToday()).toBe(false)
    vi.setSystemTime(new Date(2026, 9, 19, 0, 1))
    expect(firstPathOpenToday()).toBe(true)
  })

  it('is not a run: opening the path writes no day of its own', () => {
    firstPathOpenToday()
    expect(kept()).toBeNull()
    expect(warmUpDay().marks.every((mark) => mark.state === 'waiting')).toBe(
      true,
    )
  })
})
