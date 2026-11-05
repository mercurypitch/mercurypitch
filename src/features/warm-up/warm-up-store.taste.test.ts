// The Warm-up's one free run of its own (pw-free "own"), through the
// premium rooms' free taste (free-taste-store.ts): a run that reaches its
// end with a stop finished is the run, counted once as it lands, and after
// it the path may not start another until the singer subscribes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import { provideTasteSubscription, resetFreeTasteForTests, tasteRunsUsed, tryFreeTaste, } from '@/stores/free-taste-store'
import type { WarmUpRoomId } from './warm-up-plan'
import { isRoomStop, OWNER_ROUTINE } from './warm-up-plan'
import { canStartWarmUp, enterStop, resetWarmUpForTests, routineStopFor, warmUpAgain, } from './warm-up-store'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))

const ROOMS: readonly WarmUpRoomId[] = OWNER_ROUTINE.stops
  .filter(isRoomStop)
  .map((stop) => stop.id)

function sing(index: number): void {
  const id = ROOMS[index]!
  expect(enterStop(index)).toBe(true)
  routineStopFor(id)!.finish({ id, line: 'sung', settledNote: null })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5, 9, 0))
  localStorage.clear()
  resetWarmUpForTests()
  resetFreeTasteForTests()
})

afterEach(() => {
  vi.useRealTimers()
  resetFreeTasteForTests()
})

describe("the Warm-up's free run", () => {
  it('lets every run start while the gate is off', () => {
    for (let i = 0; i < ROOMS.length; i += 1) sing(i)
    expect(tasteRunsUsed(EXERCISE_WARM_UP_PATH)).toBe(0)
    expect(canStartWarmUp()).toBe(true)
  })

  it('is used as a run lands at its end, once, and the path asks for Premium after', () => {
    tryFreeTaste(true)
    expect(canStartWarmUp()).toBe(true)
    sing(0)
    // Halfway is not a run yet.
    expect(tasteRunsUsed(EXERCISE_WARM_UP_PATH)).toBe(0)
    for (let i = 1; i < ROOMS.length - 1; i += 1) sing(i)
    expect(tasteRunsUsed(EXERCISE_WARM_UP_PATH)).toBe(0)
    // The last room done, the run is at its end: the song is no room.
    sing(ROOMS.length - 1)
    expect(tasteRunsUsed(EXERCISE_WARM_UP_PATH)).toBe(1)
    expect(canStartWarmUp()).toBe(false)
    warmUpAgain()
    expect(tasteRunsUsed(EXERCISE_WARM_UP_PATH)).toBe(1)
  })

  it('opens again for a singer with the subscription', () => {
    tryFreeTaste(true)
    for (let i = 0; i < ROOMS.length; i += 1) sing(i)
    expect(canStartWarmUp()).toBe(false)
    provideTasteSubscription(() => true)
    expect(canStartWarmUp()).toBe(true)
  })
})
