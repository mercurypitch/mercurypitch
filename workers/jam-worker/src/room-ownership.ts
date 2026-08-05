// ============================================================
// Jam room ownership lifecycle — clear host proof when a room expires
// ============================================================
//
// Durable Object storage and in-memory state must expire together. Deleting
// only storage leaves a warm object accepting the old owner token, and host
// verification requests can keep that otherwise-dead object warm forever.

export interface RoomOwnershipState {
  expired: boolean
  expiresAt: number | null
  ownerId: string | null
  ownerName: string | null
  ownerToken: string | null
}

export const ROOM_OWNERSHIP_GRACE_PERIOD_MS = 5 * 60 * 1000
export const ROOM_OWNERSHIP_EXPIRY_KEY = 'ownerExpiresAt'

export interface RoomExpiryStorage {
  delete(key: string): Promise<unknown>
  deleteAlarm(): Promise<unknown>
  put(key: string, value: number): Promise<unknown>
  setAlarm(scheduledTimeMs: number): Promise<unknown>
}

export function createRoomOwnershipState(): RoomOwnershipState {
  return {
    expired: false,
    expiresAt: null,
    ownerId: null,
    ownerName: null,
    ownerToken: null,
  }
}

/** Persist both an enforceable deadline and the alarm that performs cleanup. */
export async function scheduleRoomOwnershipExpiry(
  ownership: RoomOwnershipState,
  storage: RoomExpiryStorage,
  nowMs = Date.now(),
): Promise<number> {
  const expiresAt = nowMs + ROOM_OWNERSHIP_GRACE_PERIOD_MS
  ownership.expiresAt = expiresAt
  await Promise.all([
    storage.put(ROOM_OWNERSHIP_EXPIRY_KEY, expiresAt),
    storage.setAlarm(expiresAt),
  ])
  return expiresAt
}

/** A joining peer keeps the room alive, so clear both expiry mechanisms. */
export async function cancelRoomOwnershipExpiry(
  ownership: RoomOwnershipState,
  storage: RoomExpiryStorage,
): Promise<void> {
  ownership.expiresAt = null
  await Promise.all([
    storage.delete(ROOM_OWNERSHIP_EXPIRY_KEY),
    storage.deleteAlarm(),
  ])
}

export function roomOwnershipHasExpired(
  ownership: RoomOwnershipState,
  nowMs = Date.now(),
): boolean {
  return (
    ownership.expired ||
    (ownership.expiresAt !== null && ownership.expiresAt <= nowMs)
  )
}

/**
 * Timer-based rooms created before persisted deadlines were introduced can
 * wake with a stored token but no alarm. With no attached peers there is no
 * live room that can justify keeping that otherwise-unbounded proof.
 */
export function roomOwnershipMustExpire(
  ownership: RoomOwnershipState,
  peerCount: number,
  nowMs = Date.now(),
): boolean {
  return (
    roomOwnershipHasExpired(ownership, nowMs) ||
    (peerCount === 0 &&
      ownership.ownerToken !== null &&
      ownership.expiresAt === null)
  )
}

/** Clear memory before starting the asynchronous storage purge. */
export async function expireRoomOwnership(
  ownership: RoomOwnershipState,
  deleteStoredOwnership: () => Promise<unknown>,
): Promise<void> {
  ownership.expired = true
  ownership.expiresAt = null
  ownership.ownerId = null
  ownership.ownerName = null
  ownership.ownerToken = null
  await deleteStoredOwnership()
}
