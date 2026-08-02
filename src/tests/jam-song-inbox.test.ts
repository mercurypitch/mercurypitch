// The receiving half. Everything the peer says is untrusted, so the cases
// worth pinning are the ones where it lies or stops.

import { describe, expect, it, vi } from 'vitest'
import { SongFileInbox } from '@/lib/jam/jam-song-inbox'
import type { TransferHeader } from '@/lib/jam/jam-song-transfer'
import { sha256Hex } from '@/lib/jam/jam-song-transfer'

const payload = (n: number, fill = 3) => new Uint8Array(n).fill(fill).buffer

async function header(
  bytes: ArrayBuffer,
  over: Partial<TransferHeader> = {},
): Promise<TransferHeader> {
  return {
    transferId: 't1',
    stem: 'instrumental',
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    mime: 'audio/mp4',
    ...over,
  }
}

function inbox() {
  const stems: Array<{ stem: string; size: number }> = []
  const failures: string[] = []
  const progress: number[] = []
  const box = new SongFileInbox({
    onStem: (r) => stems.push({ stem: r.stem, size: r.blob.size }),
    onFailed: (_p, reason) => failures.push(reason),
    onProgress: (_p, p) => progress.push(p.ratio),
  })
  return { box, stems, failures, progress }
}

describe('SongFileInbox', () => {
  it('reassembles a stem and hands it on', async () => {
    const bytes = payload(600)
    const { box, stems } = inbox()
    box.offer('a', await header(bytes))
    box.chunk('a', bytes.slice(0, 300))
    box.chunk('a', bytes.slice(300))
    await box.done('a')
    expect(stems).toEqual([{ stem: 'instrumental', size: 600 }])
  })

  it('reports progress while it arrives', async () => {
    const bytes = payload(400)
    const { box, progress } = inbox()
    box.offer('a', await header(bytes))
    box.chunk('a', bytes.slice(0, 100))
    box.chunk('a', bytes.slice(100))
    expect(progress).toEqual([0.25, 1])
  })

  it('drops chunks that arrive with no offer in front of them', () => {
    // No header means no length to bound them by and no hash to check
    // them against, so accumulating would be accumulating anything.
    const { box, failures, progress } = inbox()
    box.chunk('a', payload(100))
    expect(progress).toEqual([])
    expect(failures).toEqual([])
    expect(box.has('a')).toBe(false)
  })

  it('refuses a peer that sends more than it promised', async () => {
    const bytes = payload(100)
    const { box, failures } = inbox()
    box.offer('a', await header(bytes))
    box.chunk('a', bytes)
    box.chunk('a', payload(1))
    expect(failures[0]).toMatch(/more than it promised/i)
    expect(box.has('a')).toBe(false)
  })

  it('throws away a stem whose bytes do not match the hash', async () => {
    // The quiet one: a damaged MP4 plays as silence, not as an error.
    const { box, stems, failures } = inbox()
    box.offer('a', await header(payload(200, 1)))
    box.chunk('a', payload(200, 9))
    await box.done('a')
    expect(stems).toEqual([])
    expect(failures[0]).toMatch(/damaged/i)
  })

  it('throws away a short stem', async () => {
    const bytes = payload(500)
    const { box, stems, failures } = inbox()
    box.offer('a', await header(bytes))
    box.chunk('a', bytes.slice(0, 200))
    await box.done('a')
    expect(stems).toEqual([])
    expect(failures).toHaveLength(1)
  })

  it('keeps peers apart', async () => {
    const a = payload(200, 1)
    const b = payload(200, 2)
    const { box, stems } = inbox()
    box.offer('a', await header(a))
    box.offer('b', await header(b, { stem: 'vocal' }))
    // Interleaved, as they would be if two people sent at once.
    box.chunk('a', a.slice(0, 100))
    box.chunk('b', b.slice(0, 100))
    box.chunk('a', a.slice(100))
    box.chunk('b', b.slice(100))
    await box.done('a')
    await box.done('b')
    expect(stems.map((s) => s.stem).sort()).toEqual(['instrumental', 'vocal'])
  })

  it('surfaces the sender’s reason when it aborts', () => {
    const { box, failures } = inbox()
    box.abort('a', 'You are connected through a relay')
    expect(failures[0]).toMatch(/relay/i)
  })

  it('replaces a stalled transfer rather than holding both', async () => {
    // Otherwise a transfer nobody finishes is a slow leak in a room left
    // open.
    const first = payload(1000)
    const second = payload(100)
    const { box, stems } = inbox()
    box.offer('a', await header(first))
    box.chunk('a', first.slice(0, 500))
    box.offer('a', await header(second))
    box.chunk('a', second)
    await box.done('a')
    expect(stems).toEqual([{ stem: 'instrumental', size: 100 }])
  })

  it('forgets a peer that left', async () => {
    const { box } = inbox()
    box.offer('a', await header(payload(100)))
    box.forget('a')
    expect(box.has('a')).toBe(false)
    // done() on a forgotten peer must be a no-op, not a throw.
    await expect(box.done('a')).resolves.toBeUndefined()
  })

  it('does not report anything for a done with no transfer', async () => {
    const onStem = vi.fn()
    const box = new SongFileInbox({ onStem })
    await box.done('nobody')
    expect(onStem).not.toHaveBeenCalled()
  })
})
