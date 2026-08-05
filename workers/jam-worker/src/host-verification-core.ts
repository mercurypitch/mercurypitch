// ============================================================
// Jam host verification core — Durable Object owner-token proof
// ============================================================
//
// This is kept separate from the Cloudflare RPC entrypoint so the boundary
// logic can be tested without emulating the Workers runtime.

import type { JamRoom } from './jam-room'
import { isJamRoomId } from './signaling-intent'

export interface HostVerificationEnv {
  JAM_ROOM: DurableObjectNamespace<JamRoom>
}

/** Ask exactly one room Durable Object to compare its stored host secret. */
export async function verifyRoomHost(
  env: HostVerificationEnv,
  roomId: string,
  ownerToken: string,
): Promise<boolean> {
  if (!isJamRoomId(roomId) || ownerToken === '' || ownerToken.length > 128) {
    return false
  }

  const stub = env.JAM_ROOM.get(env.JAM_ROOM.idFromName(roomId))
  const response = await stub.fetch(
    new Request('https://jam-room.internal/internal/verify-host', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Jam-Room-Id': roomId,
      },
      body: JSON.stringify({ ownerToken }),
    }),
  )
  return response.status === 204
}
