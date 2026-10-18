// ============================================================
// The Warm-up's plan: the owner's routine, and which plans run
// ============================================================

import { describe, expect, it } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { RoomStop, SongStop, WarmUpPlan, WarmUpRoomId, WarmUpStop, } from './warm-up-plan'
import { isWarmUpPlan, OWNER_ROUTINE, planWarmUp, roomCount, } from './warm-up-plan'

const room = (id: WarmUpRoomId): RoomStop => ({ kind: 'room', id })
const SONG: SongStop = { kind: 'song', opens: 'song-list' }

function names(stops: readonly WarmUpStop[]): string[] {
  return stops.map((stop) => (stop.kind === 'room' ? stop.id : 'song'))
}

describe("the owner's routine", () => {
  it('climbs Lip roll, Ng slides, Long note and Echo, then the song', () => {
    expect(names(OWNER_ROUTINE.stops)).toEqual([
      EXERCISE_LIP_ROLL_BAY,
      EXERCISE_NG_SLIDES_BRIDGE,
      EXERCISE_LONG_NOTE_LANTERN,
      EXERCISE_ECHO_STARS,
      'song',
    ])
    expect(OWNER_ROUTINE.stops.at(-1)).toEqual(SONG)
  })

  it("is today's plan, and counts four rooms, not the song", () => {
    expect(planWarmUp()).toBe(OWNER_ROUTINE)
    expect(roomCount(OWNER_ROUTINE)).toBe(4)
    expect(isWarmUpPlan(OWNER_ROUTINE)).toBe(true)
  })
})

describe('a plan this build can run', () => {
  it('takes any number of rooms, in any order, with or without the song', () => {
    const plans: WarmUpPlan[] = [
      {
        id: 'two',
        stops: [room(EXERCISE_ECHO_STARS), room(EXERCISE_LIP_ROLL_BAY)],
      },
      { id: 'one-and-a-song', stops: [room(EXERCISE_LONG_NOTE_LANTERN), SONG] },
      {
        id: 'six',
        stops: [
          room(EXERCISE_LIP_ROLL_BAY),
          room(EXERCISE_NG_SLIDES_BRIDGE),
          room(EXERCISE_LIP_ROLL_BAY),
          room(EXERCISE_LONG_NOTE_LANTERN),
          room(EXERCISE_ECHO_STARS),
          room(EXERCISE_NG_SLIDES_BRIDGE),
          SONG,
        ],
      },
    ]
    for (const plan of plans) expect(isWarmUpPlan(plan), plan.id).toBe(true)
    expect(plans.map(roomCount)).toEqual([2, 1, 6])
  })

  it('refuses a room it does not know, and a song anywhere but last', () => {
    const refused: Record<string, unknown> = {
      'an unknown room': {
        id: 'x',
        stops: [{ kind: 'room', id: 'vocal-fry' }],
      },
      'the song first': { id: 'x', stops: [SONG, room(EXERCISE_ECHO_STARS)] },
      'two songs': { id: 'x', stops: [room(EXERCISE_ECHO_STARS), SONG, SONG] },
      'only the song': { id: 'x', stops: [SONG] },
      'no stops': { id: 'x', stops: [] },
      'a song that opens something else': {
        id: 'x',
        stops: [room(EXERCISE_ECHO_STARS), { kind: 'song', opens: 'karaoke' }],
      },
      'a stop of another kind': {
        id: 'x',
        stops: [{ kind: 'break', seconds: 10 }],
      },
      'no id': { stops: [room(EXERCISE_ECHO_STARS)] },
      'stops not a list': { id: 'x', stops: room(EXERCISE_ECHO_STARS) },
      'not a plan': 'four-rooms-and-a-song',
      nothing: null,
    }
    for (const [what, plan] of Object.entries(refused)) {
      expect(isWarmUpPlan(plan), what).toBe(false)
    }
  })
})
