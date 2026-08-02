// Moving a few megabytes across the DataChannel. The cases that matter
// are the unhappy ones: a truncated MP4 plays as silence rather than as an
// error, so "arrived damaged" has to be caught here or not at all.

import { describe, expect, it, vi } from 'vitest'
import type { SendChannel, TransferHeader } from '@/lib/jam/jam-song-transfer'
import { chunkCount, chunkRange, isRelayedConnection, sendInChunks, sha256Hex, TransferIntegrityError, TransferOverflowError, TransferReceiver, } from '@/lib/jam/jam-song-transfer'

const bytesOf = (n: number, fill = 7): ArrayBuffer =>
  new Uint8Array(n).fill(fill).buffer

async function headerFor(
  payload: ArrayBuffer,
  over: Partial<TransferHeader> = {},
): Promise<TransferHeader> {
  return {
    transferId: 't1',
    stem: 'instrumental',
    bytes: payload.byteLength,
    sha256: await sha256Hex(payload),
    mime: 'audio/mp4',
    ...over,
  }
}

describe('chunkCount', () => {
  it('covers a payload that does not divide evenly', () => {
    expect(chunkCount(10, 4)).toBe(3)
    expect(chunkCount(8, 4)).toBe(2)
  })

  it('is zero for nothing to send', () => {
    expect(chunkCount(0, 4)).toBe(0)
    // A zero chunk size would otherwise be an infinite loop upstream.
    expect(chunkCount(10, 0)).toBe(0)
  })
})

describe('chunkRange', () => {
  it('clamps the last chunk to the payload', () => {
    expect(chunkRange(2, 10, 4)).toEqual({ start: 8, end: 10 })
  })

  it('never runs past the end', () => {
    expect(chunkRange(9, 10, 4)).toEqual({ start: 10, end: 10 })
  })
})

describe('TransferReceiver', () => {
  it('reassembles a payload and verifies it', async () => {
    const payload = bytesOf(1000)
    const rx = new TransferReceiver(await headerFor(payload))
    rx.accept(payload.slice(0, 400))
    rx.accept(payload.slice(400, 1000))
    expect(rx.complete).toBe(true)
    const blob = await rx.finish()
    expect(blob.size).toBe(1000)
    expect(blob.type).toBe('audio/mp4')
  })

  it('reports progress as it goes', async () => {
    const payload = bytesOf(1000)
    const rx = new TransferReceiver(await headerFor(payload))
    expect(rx.accept(payload.slice(0, 250)).ratio).toBeCloseTo(0.25)
    expect(rx.accept(payload.slice(250, 1000)).ratio).toBeCloseTo(1)
  })

  it('refuses more bytes than the header promised', async () => {
    // A peer is untrusted; without this the buffer grows to whatever it
    // decides to send.
    const payload = bytesOf(100)
    const rx = new TransferReceiver(await headerFor(payload))
    rx.accept(payload)
    expect(() => rx.accept(bytesOf(1))).toThrow(TransferOverflowError)
  })

  it('throws rather than handing back a short file', async () => {
    // The one that matters: a truncated MP4 does not fail to play, it
    // just stops partway through and looks like a broken feature.
    const payload = bytesOf(1000)
    const rx = new TransferReceiver(await headerFor(payload))
    rx.accept(payload.slice(0, 600))
    await expect(rx.finish()).rejects.toThrow(TransferIntegrityError)
  })

  it('throws when the bytes do not match the hash', async () => {
    const payload = bytesOf(500, 1)
    const header = await headerFor(payload)
    const rx = new TransferReceiver(header)
    // Right length, wrong content.
    rx.accept(bytesOf(500, 2))
    await expect(rx.finish()).rejects.toThrow(TransferIntegrityError)
  })
})

describe('sendInChunks', () => {
  function fakeChannel(over: Partial<SendChannel> = {}) {
    const sent: number[] = []
    const listeners = new Set<() => void>()
    const ch: SendChannel & { sent: number[]; drain: () => void } = {
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      readyState: 'open',
      send: (d) => sent.push(d.byteLength),
      addEventListener: (_t, fn) => listeners.add(fn),
      removeEventListener: (_t, fn) => listeners.delete(fn),
      sent,
      drain: () => {
        for (const fn of [...listeners]) fn()
      },
      ...over,
    }
    return ch
  }

  it('sends the whole payload in chunks', async () => {
    const ch = fakeChannel()
    await sendInChunks(ch, bytesOf(10), { chunkSize: 4 })
    expect(ch.sent).toEqual([4, 4, 2])
  })

  it('reports progress that ends at the total', async () => {
    const ch = fakeChannel()
    const seen: number[] = []
    await sendInChunks(ch, bytesOf(10), {
      chunkSize: 4,
      onProgress: (p) => seen.push(p.received),
    })
    expect(seen).toEqual([4, 8, 10])
  })

  it('stops when the connection closes mid-transfer', async () => {
    // Better than sending into a closed channel and reporting success.
    const ch = fakeChannel({ readyState: 'closed' })
    await expect(
      sendInChunks(ch, bytesOf(10), { chunkSize: 4 }),
    ).rejects.toThrow(/connection closed/i)
  })

  it('stops when cancelled', async () => {
    const ch = fakeChannel()
    await expect(
      sendInChunks(ch, bytesOf(10), {
        chunkSize: 4,
        signal: { aborted: true },
      }),
    ).rejects.toThrow(/cancelled/i)
  })

  it('waits for the buffer to drain instead of filling memory', async () => {
    // The whole point of backpressure: without it the send loop copies the
    // entire song into the channel's buffer as fast as it can.
    const ch = fakeChannel({ bufferedAmount: 99_999_999 })
    let settled = false
    const run = sendInChunks(ch, bytesOf(8), { chunkSize: 4 }).then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(ch.sent).toHaveLength(0)

    // Draining lets exactly one chunk through, because the fake stays full.
    ch.drain()
    await Promise.resolve()
    expect(ch.sent).toHaveLength(1)
    ;(ch as { bufferedAmount: number }).bufferedAmount = 0
    ch.drain()
    await run
    expect(ch.sent).toEqual([4, 4])
  })

  it('sets a low-water threshold so the drain event can fire at all', async () => {
    const ch = fakeChannel()
    await sendInChunks(ch, bytesOf(4), { chunkSize: 4 })
    expect(ch.bufferedAmountLowThreshold).toBeGreaterThan(0)
  })
})

describe('isRelayedConnection', () => {
  const stats = (entries: Array<[string, Record<string, unknown>]>) => ({
    getStats: vi.fn(async () => new Map(entries)),
  })

  it('is false for a direct pair', async () => {
    const pc = stats([
      [
        'p',
        {
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'l',
          remoteCandidateId: 'r',
        },
      ],
      ['l', { type: 'local-candidate', candidateType: 'host' }],
      ['r', { type: 'remote-candidate', candidateType: 'srflx' }],
    ])
    expect(await isRelayedConnection(pc)).toBe(false)
  })

  it('is true when either end is a relay', async () => {
    // Song audio never goes over TURN; it would eat the free 1,000 GB.
    const pc = stats([
      [
        'p',
        {
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'l',
          remoteCandidateId: 'r',
        },
      ],
      ['l', { type: 'local-candidate', candidateType: 'host' }],
      ['r', { type: 'remote-candidate', candidateType: 'relay' }],
    ])
    expect(await isRelayedConnection(pc)).toBe(true)
  })

  it('treats an unknown route as relayed', async () => {
    // The safe answer is the one that cannot spend somebody's allowance.
    expect(await isRelayedConnection(stats([]))).toBe(true)
  })

  it('treats a failure to ask as relayed', async () => {
    const pc = {
      getStats: vi.fn(async () => {
        throw new Error('gone')
      }),
    }
    expect(await isRelayedConnection(pc)).toBe(true)
  })
})
