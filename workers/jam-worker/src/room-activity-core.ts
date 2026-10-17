// ============================================================
// Jam room activity core — "is anyone in this room right now?"
// ============================================================
//
// Kept apart from the fetch handler (like host-verification-core) so the
// boundary logic is testable without the Workers runtime. The ICE route asks
// this before minting TURN credentials, so relay spend is tied to a live room
// instead of handed to anyone who can POST /api/jam/ice.

import type { JamRoom } from './jam-room'
import { isJamRoomId } from './signaling-intent'

export interface RoomActivityEnv {
  JAM_ROOM: DurableObjectNamespace<JamRoom>
}

/** True when the room's Durable Object reports at least one established peer. */
export async function roomHasActivePeers(
  env: RoomActivityEnv,
  roomId: string,
): Promise<boolean> {
  if (!isJamRoomId(roomId)) return false

  const stub = env.JAM_ROOM.get(env.JAM_ROOM.idFromName(roomId))
  let response: Response
  try {
    response = await stub.fetch(
      new Request('https://jam-room.internal/internal/room-active', {
        method: 'POST',
        headers: { 'X-Jam-Room-Id': roomId },
      }),
    )
  } catch {
    // The DO being unreachable must never be able to stop a real room from
    // relaying — the ICE route degrades to STUN on false, not an error.
    return false
  }
  if (!response.ok) return false
  try {
    const body = (await response.json()) as { active?: unknown }
    return body.active === true
  } catch {
    return false
  }
}
