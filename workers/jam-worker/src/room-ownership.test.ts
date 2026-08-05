// ============================================================
// Jam room ownership lifecycle — expiry regression coverage
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { cancelRoomOwnershipExpiry, createRoomOwnershipState, expireRoomOwnership, roomOwnershipHasExpired, roomOwnershipMustExpire, ROOM_OWNERSHIP_EXPIRY_KEY, ROOM_OWNERSHIP_GRACE_PERIOD_MS, scheduleRoomOwnershipExpiry, type RoomExpiryStorage, } from './room-ownership'

function expiryStorage(): RoomExpiryStorage & {
  delete: ReturnType<typeof vi.fn>
  deleteAlarm: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  setAlarm: ReturnType<typeof vi.fn>
} {
  return {
    delete: vi.fn(async () => true),
    deleteAlarm: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
    setAlarm: vi.fn(async () => undefined),
  }
}

describe('Jam room ownership expiry', () => {
  it('clears every in-memory host proof when stored room state expires', async () => {
    const ownership = createRoomOwnershipState()
    ownership.ownerId = 'host-peer'
    ownership.ownerName = 'Host'
    ownership.ownerToken = 'secret-owner-token'
    const deleteStoredOwnership = vi.fn(async () => undefined)

    await expireRoomOwnership(ownership, deleteStoredOwnership)

    expect(ownership).toEqual({
      expired: true,
      expiresAt: null,
      ownerId: null,
      ownerName: null,
      ownerToken: null,
    })
    expect(deleteStoredOwnership).toHaveBeenCalledOnce()
  })

  it('fails closed in memory even if the storage purge rejects', async () => {
    const ownership = {
      expired: false,
      expiresAt: 123,
      ownerId: 'host-peer',
      ownerName: 'Host',
      ownerToken: 'secret-owner-token',
    }

    await expect(
      expireRoomOwnership(ownership, async () => {
        throw new Error('storage unavailable')
      }),
    ).rejects.toThrow('storage unavailable')
    expect(ownership).toEqual({
      expired: true,
      expiresAt: null,
      ownerId: null,
      ownerName: null,
      ownerToken: null,
    })
  })

  it('persists a deadline and a Durable Object alarm for empty-room expiry', async () => {
    const ownership = createRoomOwnershipState()
    const storage = expiryStorage()

    const expiresAt = await scheduleRoomOwnershipExpiry(
      ownership,
      storage,
      1_000,
    )

    expect(expiresAt).toBe(1_000 + ROOM_OWNERSHIP_GRACE_PERIOD_MS)
    expect(ownership.expiresAt).toBe(expiresAt)
    expect(storage.put).toHaveBeenCalledWith(
      ROOM_OWNERSHIP_EXPIRY_KEY,
      expiresAt,
    )
    expect(storage.setAlarm).toHaveBeenCalledWith(expiresAt)
    expect(roomOwnershipHasExpired(ownership, expiresAt - 1)).toBe(false)
    expect(roomOwnershipHasExpired(ownership, expiresAt)).toBe(true)
  })

  it('cancels both persisted deadline and alarm when a peer joins', async () => {
    const ownership = createRoomOwnershipState()
    const storage = expiryStorage()
    ownership.expiresAt = 42

    await cancelRoomOwnershipExpiry(ownership, storage)

    expect(ownership.expiresAt).toBeNull()
    expect(storage.delete).toHaveBeenCalledWith(ROOM_OWNERSHIP_EXPIRY_KEY)
    expect(storage.deleteAlarm).toHaveBeenCalledOnce()
  })

  it('fails closed for a cold legacy token without a deadline or peers', () => {
    const ownership = createRoomOwnershipState()
    ownership.ownerToken = 'legacy-unbounded-token'

    expect(roomOwnershipMustExpire(ownership, 0)).toBe(true)
    expect(roomOwnershipMustExpire(ownership, 1)).toBe(false)
  })
})
