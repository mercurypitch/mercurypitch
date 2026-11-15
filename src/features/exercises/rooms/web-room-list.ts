// ============================================================
// The web's rooms as the Exercises tab lists them
// ============================================================
//
// The exercise rooms are the native app's, and the web opens the same ones
// (owner, 15 Nov 2026): a room is one page over a world of its own, with
// Merc in it (src/components/room-kit). A room's name, its one line, its
// glyph and its best are the catalogue's, so the web and the native app say
// the same of each. Which rooms, and in what order, is web-room-ids.ts.

import type { PremiumExercise } from '@/features/premium-exercises/catalogue'
import { EXERCISE_CATALOGUE } from '@/features/premium-exercises/catalogue'
import type { WebRoomId } from './web-room-ids'
import { WEB_ROOM_IDS } from './web-room-ids'

/** One of the web's rooms and what the catalogue says of it. */
export interface WebRoom {
  readonly id: WebRoomId
  readonly entry: PremiumExercise
}

/** The web's rooms with their catalogue entries, in the tab's order. */
export function webRooms(): WebRoom[] {
  return WEB_ROOM_IDS.flatMap((id) => {
    const entry = EXERCISE_CATALOGUE.find((e) => e.id === id)
    return entry === undefined ? [] : [{ id, entry }]
  })
}

/** A room's name, as its bar and its card say it. */
export function webRoomName(id: WebRoomId): string {
  return EXERCISE_CATALOGUE.find((e) => e.id === id)?.name ?? 'Exercise'
}
