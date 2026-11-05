// The premium rooms' free taste on this phone (free-taste-store.ts): the
// gate on only in a build with the premium exercises and while the flip or
// the Developer screen's switch says so, runs counted only then, a Warm-up
// stop's runs left to the Warm-up, and a run held back in a room whose
// taste is used.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LEAP_CLIFFS, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { freeTasteOn, holdAnotherRun, holdTasteForStop, noteRoomOpened, noteTasteRun, provideTasteOffer, provideTasteSubscription, resetFreeTaste, resetFreeTasteForTests, tasteAllows, tasteRunsLeft, tasteRunsUsed, tasteShows, tryFreeTaste, } from './free-taste-store'

const build = vi.hoisted(() => ({ premium: true }))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get PREMIUM_EXERCISES() {
    return build.premium
  },
}))

beforeEach(() => {
  localStorage.clear()
  build.premium = true
  resetFreeTasteForTests()
})

afterEach(() => {
  resetFreeTasteForTests()
})

describe('the free taste', () => {
  it('is off until the flip or the Developer switch, and counts nothing then', () => {
    expect(freeTasteOn()).toBe(false)
    noteTasteRun(EXERCISE_LEAP_CLIFFS)
    expect(tasteRunsUsed(EXERCISE_LEAP_CLIFFS)).toBe(0)
    expect(tasteAllows(EXERCISE_LEAP_CLIFFS)).toBe(true)
    expect(tasteShows()).toBe(false)
  })

  it('stays off on a build without the premium exercises, switch or no', () => {
    build.premium = false
    tryFreeTaste(true)
    expect(freeTasteOn()).toBe(false)
  })

  it("counts a room's finished runs and closes it once they are used", () => {
    tryFreeTaste(true)
    expect(tasteShows()).toBe(true)
    for (let i = 0; i < 2; i += 1) noteTasteRun(EXERCISE_LEAP_CLIFFS)
    expect(tasteRunsLeft(EXERCISE_LEAP_CLIFFS)).toBe(1)
    expect(tasteAllows(EXERCISE_LEAP_CLIFFS)).toBe(true)
    noteTasteRun(EXERCISE_LEAP_CLIFFS)
    expect(tasteAllows(EXERCISE_LEAP_CLIFFS)).toBe(false)
    // Another room's taste is its own.
    expect(tasteAllows(EXERCISE_ECHO_STARS)).toBe(true)
    // And a run that is not a premium room's counts for nothing.
    noteTasteRun('long-note')
    expect(
      Object.keys(
        JSON.parse(localStorage.getItem('mp:free-taste-runs') ?? '{}'),
      ),
    ).toEqual([EXERCISE_LEAP_CLIFFS])
  })

  it('keeps the counts on this phone, under an mp: key', () => {
    tryFreeTaste(true)
    noteTasteRun(EXERCISE_ECHO_STARS)
    expect(
      JSON.parse(localStorage.getItem('mp:free-taste-runs') ?? '{}'),
    ).toEqual({ [EXERCISE_ECHO_STARS]: 1 })
  })

  it('opens every room to a singer with the subscription', () => {
    tryFreeTaste(true)
    noteTasteRun(EXERCISE_ECHO_STARS)
    expect(tasteAllows(EXERCISE_ECHO_STARS)).toBe(false)
    const release = provideTasteSubscription(() => true)
    expect(tasteAllows(EXERCISE_ECHO_STARS)).toBe(true)
    expect(tasteShows()).toBe(false)
    release()
    expect(tasteAllows(EXERCISE_ECHO_STARS)).toBe(false)
  })

  it("leaves a Warm-up stop's runs to the Warm-up", () => {
    tryFreeTaste(true)
    const release = holdTasteForStop(EXERCISE_ECHO_STARS)
    noteTasteRun(EXERCISE_ECHO_STARS)
    expect(tasteRunsUsed(EXERCISE_ECHO_STARS)).toBe(0)
    noteTasteRun(EXERCISE_WARM_UP_PATH)
    expect(tasteAllows(EXERCISE_WARM_UP_PATH)).toBe(false)
    release()
    noteTasteRun(EXERCISE_ECHO_STARS)
    expect(tasteRunsUsed(EXERCISE_ECHO_STARS)).toBe(1)
  })

  it('holds another run back in a room a card opened, once its taste is used', () => {
    tryFreeTaste(true)
    const offered: string[] = []
    provideTasteOffer((id) => offered.push(id))
    // No room opened by a card: nothing to hold.
    expect(holdAnotherRun()).toBe(false)
    noteRoomOpened(EXERCISE_ECHO_STARS)
    expect(holdAnotherRun()).toBe(false)
    noteTasteRun(EXERCISE_ECHO_STARS)
    expect(holdAnotherRun()).toBe(true)
    expect(offered).toEqual([EXERCISE_ECHO_STARS])
  })

  it('gives every room its runs again from the Developer screen', () => {
    tryFreeTaste(true)
    noteTasteRun(EXERCISE_ECHO_STARS)
    resetFreeTaste()
    expect(tasteAllows(EXERCISE_ECHO_STARS)).toBe(true)
  })
})
