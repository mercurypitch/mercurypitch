// ============================================================
// The web's rooms as the Exercises tab lists them
// ============================================================
//
// The exercise rooms are the native app's, and the web opens the same ones
// (owner, 15 Nov 2026): a room is one page over a world of its own, with
// Merc in it (src/components/room-kit). A room's name, its one line, its
// glyph and its best are the catalogue's, so the web and the native app say
// the same of each. Which rooms, and in what order, is web-room-ids.ts.
//
// One line differs: the Warm-up's. The catalogue's counts the native
// routine's five stops; the web's has four, First note not among them
// (warm-up-plan.ts WEB_ROUTINE), and its path says "3 min" at every level.

import type { PremiumExercise } from '@/features/premium-exercises/catalogue'
import { EXERCISE_CATALOGUE } from '@/features/premium-exercises/catalogue'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import type { WebRoomId } from './web-room-ids'
import { WEB_ROOM_IDS } from './web-room-ids'

/** The Warm-up's line on the web, for its routine of four stops. */
export const WEB_WARM_UP_LINE = 'Four stops, about three minutes, then a song.'

/** One of the web's rooms and what the catalogue says of it. */
export interface WebRoom {
  readonly id: WebRoomId
  readonly entry: PremiumExercise
}

/** The web's rooms with their catalogue entries, in the tab's order. */
export function webRooms(): WebRoom[] {
  return WEB_ROOM_IDS.flatMap((id): WebRoom[] => {
    const entry = EXERCISE_CATALOGUE.find((e) => e.id === id)
    if (entry === undefined) return []
    if (id !== EXERCISE_WARM_UP_PATH) return [{ id, entry }]
    return [{ id, entry: { ...entry, line: WEB_WARM_UP_LINE } }]
  })
}

/** A room's name, as its bar and its card say it. */
export function webRoomName(id: WebRoomId): string {
  return EXERCISE_CATALOGUE.find((e) => e.id === id)?.name ?? 'Exercise'
}
