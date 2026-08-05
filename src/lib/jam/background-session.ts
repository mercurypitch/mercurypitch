// ============================================================
// Jam background session — capability timing and peer trust boundary
// ============================================================
//
// The room Durable Object names the current host peer. Protected-image
// capabilities still receive full server validation, but accepting them only
// from that peer prevents another participant from replacing a working room
// image with a forged credential and causing a local denial of service.

import type { JamBackgroundCapabilityMessage, JamRoomBackgroundState, } from './types'

/** Refresh early enough to survive one transient network failure. */
export const JAM_BACKGROUND_REFRESH_LEAD_MS = 90_000

/**
 * Hosts render with their live account entitlement. Guests deliberately do
 * not: their room-scoped capability is the only evidence they need. Keeping
 * this decision ahead of the same-version fast path prevents a revoked host
 * from retaining an already decoded premium blob indefinitely.
 */
export function mayRenderJamPremiumBackground(options: {
  access: 'free' | 'locked' | 'unlocked'
  hasGuestCapability: boolean
  isHost: boolean
}): boolean {
  return options.isHost
    ? options.access === 'unlocked'
    : options.hasGuestCapability
}

export function jamCapabilityExpiryMs(
  capability: JamBackgroundCapabilityMessage,
): number | null {
  const parsed = Date.parse(capability.expiresAt)
  return Number.isFinite(parsed) ? parsed : null
}

export type JamBackgroundCapabilityAcceptance =
  | 'current'
  | 'pending-background'
  | 'rejected'

/**
 * The pass and room selection use different transports, so either may arrive
 * first. Trust only the Durable Object-named host, but retain a valid pass
 * briefly when its matching background state has not arrived yet.
 */
export function classifyJamBackgroundCapability(
  capability: JamBackgroundCapabilityMessage,
  options: {
    background: JamRoomBackgroundState | null
    fromPeerId: string
    hostPeerId: string | null
    now?: number
  },
): JamBackgroundCapabilityAcceptance {
  const expiry = jamCapabilityExpiryMs(capability)
  if (
    options.hostPeerId === null ||
    options.fromPeerId !== options.hostPeerId ||
    !Number.isSafeInteger(capability.version) ||
    capability.version <= 0 ||
    capability.token.length < 24 ||
    capability.token.length > 512 ||
    expiry === null ||
    expiry <= (options.now ?? Date.now())
  ) {
    return 'rejected'
  }
  return options.background?.backgroundId === capability.backgroundId
    ? 'current'
    : 'pending-background'
}

export function isCurrentJamBackgroundCapability(
  capability: JamBackgroundCapabilityMessage,
  options: {
    background: JamRoomBackgroundState | null
    fromPeerId: string
    hostPeerId: string | null
    now?: number
  },
): boolean {
  return classifyJamBackgroundCapability(capability, options) === 'current'
}

export function jamBackgroundCapabilityNeedsRefresh(
  capability: JamBackgroundCapabilityMessage | null,
  now: number = Date.now(),
): boolean {
  if (capability === null) return true
  const expiry = jamCapabilityExpiryMs(capability)
  return expiry === null || expiry - now <= JAM_BACKGROUND_REFRESH_LEAD_MS
}

export function applyNewerJamBackground(
  current: JamRoomBackgroundState | null,
  incoming: JamRoomBackgroundState,
): JamRoomBackgroundState {
  if (current !== null && incoming.revision < current.revision) return current
  return incoming
}
