// ============================================================
// The ids of the rooms the web opens, and nothing of the rooms
// ============================================================
//
// The Exercises page asks, in every build, whether the exercise it was
// handed is one of the web's rooms. So this module holds the ids alone: a
// room's name, its glyph and the stores behind its card are the
// catalogue's, and they load with the web's way in (web-room-list.ts),
// which a native build folds away (`WEB_ROOMS`, src/lib/native-build.ts).
//
// The Warm-up is one of them: a path whose stops are four of the others,
// each opened over it in the same frame (WebRoomHost.tsx). Not on the web
// yet: First note, whose songs are the native Karaoke's.

import type { ExerciseType, PremiumExerciseId, } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_HARMONY_LAKE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'

/** The rooms the web opens, in the order its tab lists them, which is the
 *  catalogue's. Each is an exercise the tab can hold as its selected one. */
export const WEB_ROOM_IDS = [
  EXERCISE_LONG_NOTE_LANTERN,
  EXERCISE_ECHO_STARS,
  EXERCISE_WARM_UP_PATH,
  EXERCISE_LIP_ROLL_BAY,
  EXERCISE_NG_SLIDES_BRIDGE,
  EXERCISE_HOME_NOTE_LIGHTHOUSE,
  EXERCISE_LEAP_CLIFFS,
  EXERCISE_HARMONY_LAKE,
] as const satisfies readonly Extract<PremiumExerciseId, ExerciseType>[]

/** One of the web's rooms. */
export type WebRoomId = (typeof WEB_ROOM_IDS)[number]

/** Whether the web opens a room for this exercise. */
export function isWebRoom(id: string | null | undefined): id is WebRoomId {
  return (
    typeof id === 'string' && (WEB_ROOM_IDS as readonly string[]).includes(id)
  )
}
