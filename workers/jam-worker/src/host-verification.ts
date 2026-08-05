// ============================================================
// Jam host verification — private RPC entrypoint
// ============================================================
//
// Only Workers with an explicit named-entrypoint service binding can invoke
// this method. It is not attached to the Jam Worker's public HTTP routes.

import { WorkerEntrypoint } from 'cloudflare:workers'
import { type HostVerificationEnv, verifyRoomHost, } from './host-verification-core'

export class JamHostVerifier extends WorkerEntrypoint<HostVerificationEnv> {
  async verifyHost(roomId: string, ownerToken: string): Promise<boolean> {
    return verifyRoomHost(this.env, roomId, ownerToken)
  }
}
