// The store's own state machine, with the peer faked so the callbacks
// can be fired in the orders that actually happen on real devices —
// including the ones that only show up when somebody is slow walking
// across a room with a tablet.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncPeerCallbacks } from '@/lib/sync/sync-peer'

const peerMock = vi.hoisted(() => ({
  handlers: null as SyncPeerCallbacks | null,
  roomId: 'ABCD2345' as string | null,
  peerId: 'peer-1' as string | null,
  connection: { getStats: async () => new Map() } as unknown,
  createRoom: vi.fn(() => Promise.resolve()),
  joinRoom: vi.fn(() => Promise.resolve()),
  leaveRoom: vi.fn(() => Promise.resolve()),
  dispose: vi.fn(),
  sendControl: vi.fn(),
  channelTo: vi.fn(() => ({ readyState: 'open' })),
}))

vi.mock('@/lib/sync/sync-peer', () => ({
  createSyncPeer: (cb: SyncPeerCallbacks) => {
    peerMock.handlers = cb
    return {
      createRoom: peerMock.createRoom,
      joinRoom: peerMock.joinRoom,
      leaveRoom: peerMock.leaveRoom,
      dispose: peerMock.dispose,
      sendControl: peerMock.sendControl,
      channelTo: peerMock.channelTo,
      connectionTo: () => peerMock.connection,
      getRoomId: () => peerMock.roomId,
      getPeerId: () => peerMock.peerId,
    }
  },
}))

const route = vi.hoisted(() => ({
  awaitDirectRoute: vi.fn(() => Promise.resolve('direct' as string)),
}))
vi.mock('@/lib/jam/jam-song-transfer', () => route)

const bundle = vi.hoisted(() => ({
  buildPortableBundle: vi.fn(() =>
    Promise.resolve({
      manifest: { song: { quality: 'portable' }, parts: [{ bytes: 10 }] },
    }),
  ),
  importPortableBundle: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/db/services/portable-bundle-service', () => bundle)

const uvr = vi.hoisted(() => ({
  session: { id: 's1', fileHash: 'hash-1' } as
    | Record<string, unknown>
    | undefined,
}))
vi.mock('@/stores/uvr-store', () => ({ getUvrSession: () => uvr.session }))

const notes = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => notes)

vi.mock('@/db/durable-write', () => ({
  storageEstimate: () => Promise.resolve({ quota: 1e9, usage: 0 }),
}))
vi.mock('@/db/persistent-storage', () => ({
  requestPersistentStorage: () => Promise.resolve(true),
}))

import { sendSongToPeer, startSyncReceive, stopSync, syncError, syncPeerRoom, syncState, syncTransfers, } from '@/stores/sync-store'

/** Drive the store to a live room with a connected peer. */
async function connect(): Promise<void> {
  await startSyncReceive()
  peerMock.handlers?.onChannelReady('peer-1', 'Computer')
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useRealTimers()
  stopSync()
  peerMock.roomId = 'ABCD2345'
  peerMock.peerId = 'peer-1'
  uvr.session = { id: 's1', fileHash: 'hash-1' }
  route.awaitDirectRoute.mockResolvedValue('direct')
})

describe('waiting for the other device', () => {
  it('gives up only after half a minute', async () => {
    vi.useFakeTimers()
    await startSyncReceive()
    vi.advanceTimersByTime(25_000)
    // Twenty seconds was long enough to accuse somebody of mistyping a
    // code while they were still walking to the other device.
    expect(syncError()).toBeNull()
    vi.advanceTimersByTime(6_000)
    expect(syncError()).toContain('No device joined')
    vi.useRealTimers()
  })

  it('takes the warning back when a device does join', async () => {
    vi.useFakeTimers()
    await startSyncReceive()
    vi.advanceTimersByTime(31_000)
    expect(syncError()).toContain('No device joined')

    peerMock.handlers?.onChannelReady('peer-1', 'Computer')

    // The reported symptom: a green "Connected to Computer" chip sitting
    // directly under a red "nobody joined with that code" warning.
    expect(syncState()).toBe('connected')
    expect(syncError()).toBeNull()
    vi.useRealTimers()
  })

  it('does not swallow a real failure when a device reconnects', async () => {
    vi.useFakeTimers()
    await startSyncReceive()
    // A transfer that failed on its own terms is still worth reading
    // after the far device comes back, so only the waiting warning is
    // retracted — not whatever else is on screen.
    peerMock.handlers?.onError('The song could not be saved.')
    peerMock.handlers?.onChannelReady('peer-1', 'Computer')
    expect(syncError()).toBe('The song could not be saved.')
    vi.useRealTimers()
  })

  it('puts the clock back on when the peer leaves again', async () => {
    vi.useFakeTimers()
    await connect()
    peerMock.handlers?.onPeerLeft('peer-1')
    expect(syncState()).toBe('waiting')
    // Without re-arming, a device that connects, drops and never returns
    // leaves the modal waiting with no deadline behind it.
    vi.advanceTimersByTime(31_000)
    expect(syncError()).not.toBeNull()
    vi.useRealTimers()
  })

  it('stops blaming the code once a device has used it', async () => {
    vi.useFakeTimers()
    await connect()
    peerMock.handlers?.onPeerLeft('peer-1')
    vi.advanceTimersByTime(31_000)
    // A device connected, so the code was right. Telling somebody to go
    // and re-check it sends them to look at the one thing known to be
    // fine — the same class of mistake as blaming Wi-Fi for a route that
    // had simply not been chosen yet.
    expect(syncError()).toContain('has not come back')
    expect(syncError()).not.toContain('Check the code')
    vi.useRealTimers()
  })

  it('takes the come-back warning back too', async () => {
    vi.useFakeTimers()
    await connect()
    peerMock.handlers?.onPeerLeft('peer-1')
    vi.advanceTimersByTime(31_000)
    peerMock.handlers?.onChannelReady('peer-2', 'Tablet')
    expect(syncError()).toBeNull()
    vi.useRealTimers()
  })
})

describe('what the far device said about itself', () => {
  /** A session big enough that the pre-pack room check has something to bite on. */
  const bigSong = {
    id: 's1',
    fileHash: 'hash-1',
    outputs: { vocal: {}, instrumental: {} },
    stemMeta: {
      vocal: { duration: 200, size: 5e6 },
      instrumental: { duration: 200, size: 5e6 },
    },
  }

  it('forgets it when the session ends', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', {
      type: 'sync-hello',
      label: 'Living room TV',
      freeBytes: 1e6,
      quota: 16e6,
    })
    expect(syncPeerRoom()?.freeBytes).toBe(1e6)

    stopSync()
    // A reading about a device that is no longer on the other end.
    // `onPeerLeft` already cleared this; ending the whole session did not.
    expect(syncPeerRoom()).toBeNull()
  })

  it('does not judge the next device by the last one', async () => {
    uvr.session = bigSong
    await connect()
    peerMock.handlers?.onControl('peer-1', {
      type: 'sync-hello',
      label: 'Living room TV',
      freeBytes: 1e6,
      quota: 16e6,
    })

    // Close, then pair with something roomier. Its own hello has not
    // landed yet — which is exactly the window the stale figure survived
    // into, marking every song "too big for that device" and refusing the
    // send against a TV that had already gone.
    stopSync()
    await connect()
    await sendSongToPeer('s1')

    // It got as far as packing, which is the claim: the pre-pack room
    // check no longer had a dead device's figure to refuse against. (The
    // transfer still ends unhappily here — the fake channel cannot carry
    // the real wire protocol — but not for the reason under test.)
    expect(bundle.buildPortableBundle).toHaveBeenCalled()
    expect(syncTransfers()[0]?.message).not.toContain('free')
  })
})

describe('refusing to send', () => {
  it('does not blame Wi-Fi when it simply cannot tell yet', async () => {
    route.awaitDirectRoute.mockResolvedValue('unknown')
    await connect()
    await sendSongToPeer('s1')

    const failed = syncTransfers()[0]
    expect(failed?.status).toBe('failed')
    // The reported confusion: told to check the network and get on the
    // same Wi-Fi, when the devices were already on it and a retry worked.
    expect(failed?.message).toContain('Could not confirm a direct connection')
    expect(failed?.message).not.toContain('Wi-Fi')
    // And nothing was packed — tens of seconds of encode not spent.
    expect(bundle.buildPortableBundle).not.toHaveBeenCalled()
  })

  it('still says Wi-Fi when the route really is a relay', async () => {
    route.awaitDirectRoute.mockResolvedValue('relayed')
    await connect()
    await sendSongToPeer('s1')

    expect(syncTransfers()[0]?.message).toContain('same Wi-Fi')
    expect(bundle.buildPortableBundle).not.toHaveBeenCalled()
  })

  it('packs once the route is known to be direct', async () => {
    await connect()
    await sendSongToPeer('s1')
    expect(bundle.buildPortableBundle).toHaveBeenCalled()
  })
})
