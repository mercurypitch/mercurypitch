// The premium rooms' free taste, as rules (free-taste.ts): how many runs
// each room gives, what its card says, and the funnel's names for it.

import { describe, expect, it } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_HARMONY_LAKE, EXERCISE_LEAP_CLIFFS, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { APP_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import { FREE_RUNS, isPremiumExercise, ROOM_EVENTS, roomOfferLine, runsLeft, tasteLine, } from './free-taste'

describe('the free taste', () => {
  it('gives each Ear room three runs, the Warm-up and the first rooms one', () => {
    expect(FREE_RUNS[EXERCISE_LEAP_CLIFFS]).toBe(3)
    expect(FREE_RUNS[EXERCISE_HARMONY_LAKE]).toBe(3)
    expect(FREE_RUNS[EXERCISE_ECHO_STARS]).toBe(1)
    expect(FREE_RUNS[EXERCISE_WARM_UP_PATH]).toBe(1)
    expect(Object.keys(FREE_RUNS)).toHaveLength(9)
  })

  it('knows a premium room by its id', () => {
    expect(isPremiumExercise(EXERCISE_LEAP_CLIFFS)).toBe(true)
    expect(isPremiumExercise('long-note')).toBe(false)
    expect(isPremiumExercise('toString')).toBe(false)
  })

  it('counts the runs left down to none', () => {
    expect(runsLeft(EXERCISE_LEAP_CLIFFS, 0)).toBe(3)
    expect(runsLeft(EXERCISE_LEAP_CLIFFS, 2)).toBe(1)
    expect(runsLeft(EXERCISE_LEAP_CLIFFS, 7)).toBe(0)
  })

  it("says the taste on a room's card", () => {
    expect(tasteLine(EXERCISE_LEAP_CLIFFS, 0)).toBe('3 free runs')
    expect(tasteLine(EXERCISE_LEAP_CLIFFS, 1)).toBe('2 free runs left')
    expect(tasteLine(EXERCISE_LEAP_CLIFFS, 2)).toBe('1 free run left')
    expect(tasteLine(EXERCISE_LEAP_CLIFFS, 3)).toBe('Free runs used')
    expect(tasteLine(EXERCISE_ECHO_STARS, 0)).toBe('1 free run')
    expect(tasteLine(EXERCISE_WARM_UP_PATH, 0)).toBe('Your free warm-up')
    expect(tasteLine(EXERCISE_WARM_UP_PATH, 1)).toBe('Free warm-up used')
  })

  it('names the room on the offer it opens', () => {
    expect(roomOfferLine(EXERCISE_LEAP_CLIFFS)).toMatch(
      /^You've had your free runs of Leap\. Every Merc room/u,
    )
    expect(roomOfferLine(EXERCISE_ECHO_STARS)).toMatch(
      /^You've had your free run of Echo\./u,
    )
    expect(roomOfferLine(EXERCISE_WARM_UP_PATH)).toMatch(
      /^You've had your free warm-up\./u,
    )
  })

  it("counts each room's steps by names the funnel's catalogue holds", () => {
    const catalogue = new Set<string>(APP_FUNNEL_EVENTS)
    const names = Object.values(ROOM_EVENTS).flatMap((room) => [
      room.tap,
      room.open,
      room.offer,
      room.trial,
    ])
    expect(names).toHaveLength(36)
    expect(new Set(names).size).toBe(36)
    for (const name of names) expect(catalogue.has(name), name).toBe(true)
    expect(catalogue.has('cloud_view_room')).toBe(true)
  })
})
