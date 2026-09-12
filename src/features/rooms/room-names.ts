// ============================================================
// Room names — what a room calls itself, as opposed to what it does
// ============================================================
//
// "Sing" is the activity. "Retro Analog Studio" is the room you are standing
// in, and it is what the native room header's chip and the session pill say —
// a header reading "Sing" over a photograph of a studio is the app naming the
// tab it is on rather than the place it has put you (device round 1, P4).
//
// THESE ARE THE MOCK'S NAMES, not a catalogue a singer can choose from. One
// room per instrument, fixed, exactly as the approved screens draw it; the
// real per-room art, the picker and the backgrounds are Phase 3 and Phase 1b.
// Until then this is the single place the seven names are written, so the
// header, the pill and anything that grows a room label next cannot disagree.
//
// A LEAF, like `contract.ts` and `registry.ts` beside it: the only import is a
// type, so a standalone room bundle that pulls this in stays inside its
// isolation gate.

import type { RoomId } from './contract'

/**
 * Every room with a name, including the one that is not a `RoomId` yet.
 *
 * Jam is a tab and not a hostable room, so it is not in `RoomId` — but it is
 * a place with a name in the mock, and leaving it out would mean two maps.
 */
export type NamedRoomId = RoomId | 'jam'

export const ROOM_NAMES: Record<NamedRoomId, string> = {
  sing: 'Retro Analog Studio',
  karaoke: 'Broadway Theater',
  piano: 'Nocturne Studio',
  guitar: 'Alpine Lodge',
  drums: 'Pocket Console',
  'ear-lab': 'Workshop',
  jam: 'Indie Loft',
}

/** The room's own name, for a header chip, a pill, or anything that names it. */
export function roomName(id: NamedRoomId): string {
  return ROOM_NAMES[id]
}
