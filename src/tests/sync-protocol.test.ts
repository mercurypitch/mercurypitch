// Two devices linked by an in-memory wire: a full song crosses the sync
// protocol into the REAL import path (fake-indexeddb), exactly as it will
// over a DataChannel. What is faked is only the pipe itself — so these
// tests prove the pull loop, the per-part verification, the bounded
// retry, the ACK, and the rollback, independent of WebRTC.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom's Blob has no arrayBuffer(); both bundle halves rely on it.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error as Error)
      fr.readAsArrayBuffer(this)
    })
  }
}

import { saveLyricsToDbStrict } from '@/db/services/lyrics-db-service'
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import { saveStemBlobDurable } from '@/db/services/uvr-service'
import type { SendChannel } from '@/lib/jam/jam-song-transfer'
import type * as PortableAudio from '@/lib/portable/portable-audio'
import type { SyncWireMessage } from '@/lib/sync/sync-protocol'
import { isSyncWireMessage, receiveBundleOverWire, sendBundleOverWire, SENDER_SILENCE_MS, } from '@/lib/sync/sync-protocol'
import type { UvrSession } from '@/stores/uvr-store'
import { deleteAllUvrSessions, getUvrSessionByHash, saveAllUvrSessions, } from '@/stores/uvr-store'

vi.mock('@/lib/portable/portable-audio', async (importOriginal) => {
  const actual = await importOriginal<typeof PortableAudio>()
  return {
    ...actual,
    encodeStemToAac: vi.fn(
      (_wav: ArrayBuffer, opts?: { tier?: string }): Promise<Uint8Array> =>
        Promise.resolve(
          new TextEncoder().encode(`aac:${opts?.tier ?? 'default'}`),
        ),
    ),
  }
})

const SOURCE_ID = 'wire-source'
const HASH = 'hash-of-the-wire-song'

async function seedSourceSong(): Promise<void> {
  const session: UvrSession = {
    sessionId: SOURCE_ID,
    status: 'completed',
    progress: 100,
    fileHash: HASH,
    originalFile: { name: 'Wires.mp3', size: 4_000, mimeType: 'audio/mpeg' },
    stemMeta: { vocal: { duration: 200 }, instrumental: { duration: 200 } },
    createdAt: 1,
  }
  saveAllUvrSessions([session])
  const wav = (label: string) =>
    new Blob([new TextEncoder().encode(`wav:${label}`)], { type: 'audio/wav' })
  await saveStemBlobDurable(SOURCE_ID, 'vocal', wav('vocal'), 'vocal.wav')
  await saveStemBlobDurable(
    SOURCE_ID,
    'instrumental',
    wav('instrumental'),
    'instrumental.wav',
  )
  await saveLyricsToDbStrict(SOURCE_ID, {
    text: '[00:02.00]Down the wire',
    format: 'lrc',
    filename: 'wires.lrc',
  })
}

/**
 * The in-memory wire. Frames and bytes are delivered on a microtask, the
 * way a channel never delivers into the caller's own stack.
 */
interface Wire {
  channel: SendChannel
  senderPort: { sendControl: (msg: SyncWireMessage) => boolean }
  receiverPort: { sendControl: (msg: SyncWireMessage) => boolean }
  toReceiver: {
    control: (msg: SyncWireMessage) => void
    chunk: (b: ArrayBuffer) => void
  }
  toSender: { control: (msg: SyncWireMessage) => void }
  /** Every part-request the receiver made, in order. */
  requests: string[]
  /** Chunks delivered to the receiver, for counting and corrupting. */
  chunksDelivered: number
  corruptChunk: ((bytes: Uint8Array) => void) | null
}

function makeWire(): Wire {
  const wire: Wire = {
    channel: null as unknown as SendChannel,
    senderPort: null as unknown as Wire['senderPort'],
    receiverPort: null as unknown as Wire['receiverPort'],
    toReceiver: { control: () => {}, chunk: () => {} },
    toSender: { control: () => {} },
    requests: [],
    chunksDelivered: 0,
    corruptChunk: null,
  }
  const later = (fn: () => void) => void Promise.resolve().then(fn)
  wire.channel = {
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    readyState: 'open',
    send: (data: ArrayBuffer) => {
      const copy = new Uint8Array(data.slice(0))
      wire.corruptChunk?.(copy)
      later(() => {
        wire.chunksDelivered += 1
        wire.toReceiver.chunk(copy.buffer as ArrayBuffer)
      })
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  wire.senderPort = {
    sendControl: (msg) => {
      later(() => wire.toReceiver.control(msg))
      return true
    },
  }
  wire.receiverPort = {
    sendControl: (msg) => {
      if (msg.type === 'part-request') wire.requests.push(msg.part)
      later(() => wire.toSender.control(msg))
      return true
    },
  }
  return wire
}

/** Build on device A, wipe the library, receive on "device B". */
async function crossTheWire(
  wire: Wire,
  opts: {
    checkRoom?: (
      bytes: number,
    ) => Promise<{ ok: true } | { ok: false; message: string }>
  } = {},
) {
  await seedSourceSong()
  const bundle = await buildPortableBundle(SOURCE_ID, { tier: 'portable-192' })
  deleteAllUvrSessions()

  const sender = sendBundleOverWire(bundle, {
    sendControl: wire.senderPort.sendControl,
    channel: wire.channel,
  })
  wire.toSender.control = (msg) => sender.handleControl(msg)

  const receiver = receiveBundleOverWire(
    bundle.manifest,
    wire.receiverPort,
    importPortableBundle,
    opts.checkRoom === undefined ? {} : { checkRoom: opts.checkRoom },
  )
  wire.toReceiver.control = (msg) => receiver.handleControl(msg)
  wire.toReceiver.chunk = (bytes) => receiver.handleChunk(bytes)

  return { bundle, sender, receiver }
}

describe('sync protocol over a wire', () => {
  beforeEach(() => {
    deleteAllUvrSessions()
  })

  it('carries a song across and both ends know it', async () => {
    const wire = makeWire()
    const { bundle, sender, receiver } = await crossTheWire(wire)

    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent).toEqual({ outcome: 'sent' })
    expect(kept.outcome).toBe('imported')

    // The receiver pulled the parts one at a time, in manifest order.
    expect(wire.requests).toEqual(bundle.manifest.parts.map((p) => p.id))

    const arrived = getUvrSessionByHash(HASH)
    expect(arrived?.status).toBe('completed')
    expect(arrived?.audioQuality).toBe('portable-192')
  })

  it('declines a song the receiving device already has, moving no audio', async () => {
    const wire = makeWire()
    await seedSourceSong()
    const bundle = await buildPortableBundle(SOURCE_ID)
    // The library is NOT wiped: the "other device" is this one.

    const sender = sendBundleOverWire(bundle, {
      sendControl: wire.senderPort.sendControl,
      channel: wire.channel,
    })
    wire.toSender.control = (msg) => sender.handleControl(msg)
    const receiver = receiveBundleOverWire(
      bundle.manifest,
      wire.receiverPort,
      importPortableBundle,
    )
    wire.toReceiver.control = (msg) => receiver.handleControl(msg)
    wire.toReceiver.chunk = (bytes) => receiver.handleChunk(bytes)

    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent).toEqual({ outcome: 'already-there' })
    expect(kept.outcome).toBe('already-here')
    expect(wire.requests).toEqual([])
    expect(wire.chunksDelivered).toBe(0)
  })

  it('asks again for a part that arrives corrupt, and the retry lands', async () => {
    const wire = makeWire()
    // The first delivery of the instrumental part is damaged in flight;
    // every later delivery is honest.
    let damaged = false
    let currentPart = ''
    const originalPush = wire.receiverPort.sendControl
    wire.receiverPort = {
      sendControl: (msg) => {
        if (msg.type === 'part-request') currentPart = msg.part
        return originalPush(msg)
      },
    }
    wire.corruptChunk = (bytes) => {
      if (currentPart === 'stem:instrumental' && !damaged) {
        damaged = true
        bytes[0] = bytes[0]! ^ 0xff
      }
    }

    const { sender, receiver } = await crossTheWire(wire)
    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent).toEqual({ outcome: 'sent' })
    expect(kept.outcome).toBe('imported')
    // One honest request per other part, two for the damaged one.
    expect(wire.requests.filter((p) => p === 'stem:instrumental')).toHaveLength(
      2,
    )
    expect(getUvrSessionByHash(HASH)?.status).toBe('completed')
  })

  it('gives up after the retry budget, tells the sender, and keeps nothing', async () => {
    const wire = makeWire()
    let currentPart = ''
    const originalPush = wire.receiverPort.sendControl
    wire.receiverPort = {
      sendControl: (msg) => {
        if (msg.type === 'part-request') currentPart = msg.part
        return originalPush(msg)
      },
    }
    // Every delivery of the vocal part is damaged: the wire itself is bad.
    wire.corruptChunk = (bytes) => {
      if (currentPart === 'stem:vocal') bytes[0] = bytes[0]! ^ 0xff
    }

    const { sender, receiver } = await crossTheWire(wire)
    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(kept.outcome).toBe('failed')
    expect(sent.outcome).toBe('failed')
    // 1 first try + PART_RETRY_LIMIT more.
    expect(wire.requests.filter((p) => p === 'stem:vocal')).toHaveLength(3)
    // Rolled back: a clean retry later is possible.
    expect(getUvrSessionByHash(HASH)).toBeUndefined()
  })

  it('a sender abort fails the import cleanly on the far side', async () => {
    const wire = makeWire()
    const { sender, receiver } = await crossTheWire(wire)
    sender.abort('Cancelled on the sending device.')

    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent.outcome).toBe('failed')
    expect(kept.outcome).toBe('failed')
    expect(getUvrSessionByHash(HASH)).toBeUndefined()
  })
})

describe('sync protocol when the far device is full', () => {
  beforeEach(() => {
    deleteAllUvrSessions()
  })

  it('refuses before a byte moves, and says how full it is', async () => {
    const wire = makeWire()
    const asked: number[] = []
    const { sender, receiver } = await crossTheWire(wire, {
      checkRoom: (bytes) => {
        asked.push(bytes)
        return Promise.resolve({
          ok: false,
          message:
            'This device has about 8.0 MB free and the song needs 42.0 MB.',
        })
      },
    })

    const [sent, kept] = await Promise.all([sender.result, receiver.result])

    // Nothing was pulled and nothing was sent: the whole point is that a
    // device which cannot hold the song says so from the manifest, not
    // after minutes of transfer and a rollback.
    expect(wire.requests).toEqual([])
    expect(wire.chunksDelivered).toBe(0)
    expect(getUvrSessionByHash(HASH)).toBeUndefined()

    // Asked about the real total, not a guess.
    expect(asked).toHaveLength(1)
    expect(asked[0]).toBeGreaterThan(0)

    // And the sender is told the truth. Reporting this as "already there"
    // -- which every decline used to mean -- would tell somebody their
    // song had arrived when it had not.
    expect(sent.outcome).toBe('failed')
    expect(sent).toHaveProperty('message', expect.stringContaining('8.0 MB'))
    expect(kept.outcome).toBe('failed')
  })

  it('still accepts when the browser will not say how much room there is', async () => {
    const wire = makeWire()
    const { sender, receiver } = await crossTheWire(wire, {
      // What a browser with no StorageManager answers. An unknown must
      // never read as a refusal, or sync breaks entirely on those.
      checkRoom: () => Promise.resolve({ ok: true }),
    })

    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent).toEqual({ outcome: 'sent' })
    expect(kept.outcome).toBe('imported')
  })
})

describe('sync protocol when the connection dies', () => {
  it('fails the send instead of waiting for ever when a frame cannot go out', async () => {
    // The channel died while the song was packing, so the offer never
    // leaves. Before this was handled the promise never settled: the UI
    // sat on "Sending 0%" with every control disabled and no way back.
    await seedSourceSong()
    const bundle = await buildPortableBundle(SOURCE_ID)
    const dead = makeWire()
    const sender = sendBundleOverWire(bundle, {
      sendControl: () => false,
      channel: dead.channel,
    })
    const outcome = await sender.result
    expect(outcome.outcome).toBe('failed')
    if (outcome.outcome === 'failed') {
      expect(outcome.message).toContain('closed')
    }
  })

  it('gives up on a receiver that goes silent, and says why', async () => {
    // Seeded on real timers: fake-indexeddb drives itself with timers,
    // and faking them before the database work simply hangs it.
    await seedSourceSong()
    const bundle = await buildPortableBundle(SOURCE_ID)
    vi.useFakeTimers()
    try {
      // Frames "send" fine; nothing ever answers — a phone that slept.
      const silent = makeWire()
      const sender = sendBundleOverWire(bundle, {
        sendControl: () => true,
        channel: silent.channel,
      })
      const settled = vi.fn()
      void sender.result.then(settled)

      await vi.advanceTimersByTimeAsync(SENDER_SILENCE_MS - 1000)
      expect(settled).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(2000)
      const outcome = await sender.result
      expect(outcome.outcome).toBe('failed')
      if (outcome.outcome === 'failed') {
        expect(outcome.message).toContain('stopped answering')
      }
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the wire can grow without breaking older builds', () => {
  it('lets a build recognise the frames it knows and drop the rest', () => {
    // This is the property that makes adding frames safe. A device on an
    // older build receives `sync-preparing` from a newer one, does not
    // recognise it, and drops it -- so it shows no "being prepared"
    // state, and the offer that follows still lands exactly as before.
    // Without an allowlist here, growing the protocol would mean a
    // flag-day upgrade across every device somebody owns.
    expect(isSyncWireMessage({ type: 'sync-preparing' })).toBe(true)
    expect(isSyncWireMessage({ type: 'sync-cancelled' })).toBe(true)
    expect(isSyncWireMessage({ type: 'sync-offer' })).toBe(true)

    expect(isSyncWireMessage({ type: 'sync-something-new' })).toBe(false)
    expect(isSyncWireMessage({ type: 42 })).toBe(false)
    expect(isSyncWireMessage({})).toBe(false)
  })

  it('does not let an unknown frame disturb a transfer in flight', async () => {
    const wire = makeWire()
    const { sender, receiver } = await crossTheWire(wire)

    // Something a future build sends that this one has never heard of,
    // arriving mid-transfer at both ends. Neither may treat it as an
    // abort, and neither may settle on it.
    const strange = { type: 'sync-whatever', fileHash: HASH } as unknown
    sender.handleControl(strange as SyncWireMessage)
    receiver.handleControl(strange as SyncWireMessage)

    const [sent, kept] = await Promise.all([sender.result, receiver.result])
    expect(sent.outcome).toBe('sent')
    expect(kept.outcome).toBe('imported')
  })
})
