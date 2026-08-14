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
  // Nullable at the declaration because one refusal path is "there is no
  // channel at all", and a mock narrowed to the happy shape cannot say so.
  channelTo: vi.fn((): { readyState: string } | null => ({
    readyState: 'open',
  })),
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
  // Typed with its real first argument so the queue tests can assert the
  // ORDER songs were packed in, which is the whole point of a queue.
  buildPortableBundle: vi.fn((_sessionId: string, _opts?: unknown) =>
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
  /** Set by the queue tests, which need the ids to be told apart. */
  byId: null as Record<string, Record<string, unknown>> | null,
}))
vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: (id: string) => uvr.byId?.[id] ?? uvr.session,
}))

const notes = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => notes)

vi.mock('@/db/durable-write', () => ({
  storageEstimate: () => Promise.resolve({ quota: 1e9, usage: 0 }),
}))
vi.mock('@/db/persistent-storage', () => ({
  requestPersistentStorage: () => Promise.resolve(true),
}))

import { clearFinishedTransfers, enqueueSongs, sendSongToPeer, startSyncReceive, stopQueue, stopSync, syncBusy, syncError, syncPeerRoom, syncQueue, syncState, syncTransfers, } from '@/stores/sync-store'

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
  uvr.byId = null
  route.awaitDirectRoute.mockResolvedValue('direct')
  // `clearAllMocks` forgets calls but keeps implementations, so anything
  // a test points at a different answer has to be pointed back by hand.
  peerMock.connection = { getStats: async () => new Map() }
  peerMock.channelTo.mockReturnValue({ readyState: 'open' })
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

/** The control frames this device put on the wire, in order. */
function framesSent(): { type: string; message?: string }[] {
  return peerMock.sendControl.mock.calls.map(
    (call) => call[1] as { type: string; message?: string },
  )
}

describe('what the far device said about itself', () => {
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

describe('telling the receiver a song is being packed', () => {
  /** The smallest manifest `isReadableManifest` will accept. */
  const manifest = {
    format: 'mercurypitch-song',
    version: 1,
    song: { fileHash: 'hash-2', title: 'Far Song', quality: 'portable' },
    parts: [{ id: 'stem:vocal', bytes: 100, sha256: 'abc', mime: 'audio/mp4' }],
  }

  const preparing = {
    type: 'sync-preparing',
    fileHash: 'hash-2',
    title: 'Far Song',
  }

  it('announces before it starts packing, not after', async () => {
    uvr.session = bigSong
    let announcedFirst = false
    bundle.buildPortableBundle.mockImplementationOnce(() => {
      announcedFirst = framesSent().some((m) => m.type === 'sync-preparing')
      return Promise.resolve({
        manifest: { song: { quality: 'portable' }, parts: [{ bytes: 10 }] },
      })
    })

    await connect()
    await sendSongToPeer('s1')

    // The whole point: the far device hears about the song at the start of
    // the minute of encoding, not at the end of it.
    expect(announcedFirst).toBe(true)
  })

  it('promises nothing when it refuses before packing', async () => {
    route.awaitDirectRoute.mockResolvedValue('relayed')
    await connect()
    await sendSongToPeer('s1')

    // A refusal that costs the far device nothing should not first tell it
    // to expect something.
    expect(framesSent().some((m) => m.type === 'sync-preparing')).toBe(false)
  })

  it('retracts the promise when packing throws', async () => {
    uvr.session = bigSong
    bundle.buildPortableBundle.mockRejectedValueOnce(new Error('Out of memory'))

    await connect()
    await sendSongToPeer('s1')

    const cancelled = framesSent().find((m) => m.type === 'sync-cancelled')
    expect(cancelled?.message).toBe('Out of memory')
  })

  it('shows the far device working, without inventing a percentage', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', {
      ...preparing,
      estimatedBytes: 9_000_000,
    })

    const row = syncTransfers()[0]
    expect(syncTransfers()).toHaveLength(1)
    expect(row?.status).toBe('preparing')
    expect(row?.direction).toBe('in')
    expect(row?.title).toBe('Far Song')
  })

  it('replaces that row with the transfer rather than adding a second', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', preparing)
    peerMock.handlers?.onControl('peer-1', { type: 'sync-offer', manifest })

    // One song, one row, further along — not "being prepared" sitting
    // above "receiving" for the same thing.
    expect(syncTransfers()).toHaveLength(1)
    expect(syncTransfers()[0]?.status).toBe('transferring')
  })

  it('ends the row when the far device gives up', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', preparing)
    peerMock.handlers?.onControl('peer-1', {
      type: 'sync-cancelled',
      fileHash: 'hash-2',
      message: 'The song could not be packed.',
    })

    expect(syncTransfers()[0]?.status).toBe('failed')
    expect(syncTransfers()[0]?.message).toBe('The song could not be packed.')
  })

  it('does not let a late cancellation undo a song already moving', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', preparing)
    peerMock.handlers?.onControl('peer-1', { type: 'sync-offer', manifest })
    peerMock.handlers?.onControl('peer-1', {
      type: 'sync-cancelled',
      fileHash: 'hash-2',
      message: 'too late',
    })

    // Past the offer the transfer owns its own ending; a stray
    // cancellation must not be able to kill one.
    expect(syncTransfers()[0]?.status).toBe('transferring')
  })

  it('closes the row when the packing device leaves', async () => {
    await connect()
    peerMock.handlers?.onControl('peer-1', preparing)
    peerMock.handlers?.onPeerLeft('peer-1')

    // There is no sender and no receiver to abort here — only a row
    // saying a song is on its way from a device that has gone. Without
    // closing it by hand it waits for ever.
    expect(syncTransfers()[0]?.status).toBe('failed')
    expect(syncTransfers()[0]?.message).toContain('left')
  })
})

describe('sending several songs', () => {
  /** Three distinct songs, so the order they go in can be asserted. */
  function threeSongs(): void {
    uvr.byId = {
      s1: { id: 's1', fileHash: 'hash-1' },
      s2: { id: 's2', fileHash: 'hash-2' },
      s3: { id: 's3', fileHash: 'hash-3' },
    }
  }

  /** Which sessions were actually packed, in the order they were. */
  function packed(): string[] {
    return bundle.buildPortableBundle.mock.calls.map((call) => call[0])
  }

  it('sends them one at a time, in the order they were chosen', async () => {
    threeSongs()
    await connect()

    enqueueSongs(['s1', 's2', 's3'])

    await vi.waitFor(() => expect(packed()).toHaveLength(3))
    // Sequential, for the same reason a single send was: two songs
    // interleaving on one channel helps neither, and the receiver's pull
    // loop assumes one bundle at a time.
    expect(packed()).toEqual(['s1', 's2', 's3'])
    expect(syncQueue()).toEqual([])
  })

  it('does not send the same song twice for pressing Send twice', async () => {
    threeSongs()
    await connect()

    enqueueSongs(['s1', 's2'])
    enqueueSongs(['s2', 's3'])

    await vi.waitFor(() => expect(packed()).toHaveLength(3))
    expect(packed()).toEqual(['s1', 's2', 's3'])
  })

  it('keeps going when one song fails', async () => {
    threeSongs()
    bundle.buildPortableBundle.mockImplementationOnce(() =>
      Promise.reject(new Error('That stem could not be read.')),
    )
    await connect()

    enqueueSongs(['s1', 's2', 's3'])

    // One unreadable stem must not cost somebody the other two songs.
    await vi.waitFor(() => expect(packed()).toHaveLength(3))
    const failed = syncTransfers().find((t) => t.fileHash === 'hash-1')
    expect(failed?.status).toBe('failed')
    expect(failed?.message).toBe('That stem could not be read.')
  })

  it('REQ-SYNC-024: stops the queue when the link itself is the failure', async () => {
    threeSongs()
    route.awaitDirectRoute.mockResolvedValue('relayed')
    await connect()

    enqueueSongs(['s1', 's2', 's3'])

    await vi.waitFor(() => expect(syncQueue()).toEqual([]))
    // A relayed route refuses every song identically. Four VPN refusals
    // in a row, one per queued song, taught us nobody needs the last
    // three of them — one failed row and a plain "the rest were not
    // sent" is the whole story.
    expect(bundle.buildPortableBundle).not.toHaveBeenCalled()
    expect(syncTransfers().filter((t) => t.status === 'failed')).toHaveLength(1)
    expect(syncError()).toContain('were not sent')
  })

  it('stops when the other device leaves, and says so', async () => {
    threeSongs()
    await connect()

    enqueueSongs(['s1', 's2', 's3'])
    peerMock.handlers?.onPeerLeft('peer-1')

    await vi.waitFor(() => expect(syncQueue()).toEqual([]))
    // Nothing after this could have succeeded, so the queue is not left
    // quietly draining into a device that has gone.
    expect(syncError()).toContain('were not sent')
    expect(packed().length).toBeLessThan(3)
  })

  it('drops what is still waiting when asked to stop', async () => {
    threeSongs()
    await connect()

    enqueueSongs(['s1', 's2', 's3'])
    stopQueue()

    await vi.waitFor(() => expect(syncQueue()).toEqual([]))
    // The song already in flight is half sent; only the waiting ones go.
    expect(packed().length).toBeLessThan(3)
  })

  it('forgets the queue when the session ends', async () => {
    threeSongs()
    await connect()
    enqueueSongs(['s1', 's2', 's3'])

    stopSync()

    expect(syncQueue()).toEqual([])
  })
})

describe('clearing the transfer history', () => {
  it('REQ-SYNC-025: sweeps finished rows and keeps one still moving', async () => {
    route.awaitDirectRoute.mockResolvedValue('relayed')
    await connect()
    await sendSongToPeer('s1')
    peerMock.handlers?.onControl('peer-1', {
      type: 'sync-preparing',
      fileHash: 'hash-9',
      title: 'Still packing over there',
    })
    expect(syncTransfers()).toHaveLength(2)

    clearFinishedTransfers()

    // The failed row goes; the song still being packed on the far device
    // stays — clearing history must never hide live work.
    expect(syncTransfers()).toHaveLength(1)
    expect(syncTransfers()[0]?.status).toBe('preparing')
  })
})

describe('every way a send can be refused', () => {
  /**
   * One row per exit from `sendSongToPeer`. The point is not the message —
   * each of those has its own test — but that whatever happens, the
   * interlock comes back off. Six of these returns sit inside the `try`
   * and depend on the `finally` to release it; a seventh added outside
   * would wedge the modal with every control disabled and no way back,
   * and nothing else in the suite would notice.
   */
  const refusals: { name: string; arrange: () => void; saying: string }[] = [
    {
      name: 'the peer connection is gone',
      saying: 'no longer open',
      arrange: () => {
        peerMock.connection = null
      },
    },
    {
      name: 'the route is a relay',
      saying: 'same Wi-Fi',
      arrange: () => route.awaitDirectRoute.mockResolvedValue('relayed'),
    },
    {
      name: 'the route cannot be worked out',
      saying: 'Could not confirm a direct connection',
      arrange: () => route.awaitDirectRoute.mockResolvedValue('unknown'),
    },
    {
      name: 'the far device is known to be too full, before packing',
      saying: 'roughly',
      arrange: () => {
        uvr.session = bigSong
        peerMock.handlers?.onControl('peer-1', {
          type: 'sync-hello',
          label: 'Full TV',
          freeBytes: 1e3,
          quota: 16e6,
        })
      },
    },
    {
      name: 'the packed song turns out too big for the far device',
      saying: 'free and this song needs',
      arrange: () => {
        peerMock.handlers?.onControl('peer-1', {
          type: 'sync-hello',
          label: 'Full TV',
          freeBytes: 5,
          quota: 16e6,
        })
      },
    },
    {
      name: 'the channel died while the song was packing',
      saying: 'dropped while the song was being packed',
      arrange: () =>
        peerMock.channelTo.mockReturnValue({ readyState: 'closed' }),
    },
    {
      name: 'the channel is gone entirely',
      saying: 'closed before the song could be sent',
      arrange: () => peerMock.channelTo.mockReturnValue(null),
    },
    {
      name: 'packing itself throws',
      saying: 'No memory',
      arrange: () =>
        bundle.buildPortableBundle.mockRejectedValueOnce(
          new Error('No memory'),
        ),
    },
  ]

  for (const refusal of refusals) {
    it(`releases the interlock when ${refusal.name}`, async () => {
      await connect()
      refusal.arrange()

      await sendSongToPeer('s1')

      expect(syncBusy()).toBe(false)
      const row = syncTransfers()[0]
      expect(row?.status).toBe('failed')
      // The fragment is what proves these are eight DIFFERENT exits
      // rather than one path reached eight ways.
      expect(row?.message).toContain(refusal.saying)
    })
  }

  it('releases it after a send that goes all the way through', async () => {
    await connect()
    await sendSongToPeer('s1')
    expect(syncBusy()).toBe(false)
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
