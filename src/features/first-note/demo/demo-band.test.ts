// ============================================================
// The demo's band: read and decoded once, tried again after a failure
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BandSource } from './demo-band'
import { demoBand, forgetDemoBand, loadDemoBand, playBand } from './demo-band'

// The rooms' bus, stood in for: the clip's gain goes to it.
const output = vi.hoisted(() => ({ bus: { name: 'room output' } }))
vi.mock('@/components/room-kit/room-output', () => ({
  roomOutput: () => output.bus,
}))

const BUFFER = { duration: 8 } as unknown as AudioBuffer

/** A source that reads `bytes` (or fails) and decodes to BUFFER, counting. */
function source(fails = 0): BandSource & { reads: string[]; decodes: number } {
  let left = fails
  const made = {
    reads: [] as string[],
    decodes: 0,
    read: (url: string) => {
      made.reads.push(url)
      if (left > 0) {
        left -= 1
        return Promise.reject(new Error('offline'))
      }
      return Promise.resolve(new ArrayBuffer(16))
    },
    decoder: () =>
      ({
        decodeAudioData: () => {
          made.decodes += 1
          return Promise.resolve(BUFFER)
        },
      }) as unknown as BaseAudioContext,
  }
  return made
}

describe("the First note demo's band", () => {
  afterEach(() => {
    forgetDemoBand()
  })

  it('reads the bundled clip once and keeps it decoded', async () => {
    const from = source()
    expect(demoBand()).toBeNull()
    const [first, second] = await Promise.all([
      loadDemoBand(from),
      loadDemoBand(from),
    ])
    expect(first).toBe(BUFFER)
    expect(second).toBe(BUFFER)
    expect(await loadDemoBand(from)).toBe(BUFFER)
    expect(from.reads).toHaveLength(1)
    expect(from.reads[0]).toMatch(/demo-band-josephine/u)
    expect(from.decodes).toBe(1)
    expect(demoBand()).toBe(BUFFER)
  })

  it('settles null on a failed read, and tries again the next time', async () => {
    const from = source(1)
    expect(await loadDemoBand(from)).toBeNull()
    expect(demoBand()).toBeNull()
    expect(await loadDemoBand(from)).toBe(BUFFER)
    expect(from.reads).toHaveLength(2)
  })

  it('settles null with nothing to decode with', async () => {
    const from = { ...source(), decoder: () => null }
    expect(await loadDemoBand(from)).toBeNull()
  })

  it("starts the clip on the room's clock, never in its past, and fades it on stop", () => {
    const events: string[] = []
    const gain = {
      gain: {
        value: 1,
        cancelScheduledValues: () => events.push('cancel'),
        setValueAtTime: () => events.push('hold'),
        linearRampToValueAtTime: (value: number, at: number) =>
          events.push(`ramp ${value} at ${at.toFixed(2)}`),
      },
      connect: vi.fn(),
    }
    const node = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: (at: number) => events.push(`start at ${at.toFixed(2)}`),
      stop: (at: number) => events.push(`stop at ${at.toFixed(2)}`),
    }
    const ctx = {
      currentTime: 5,
      createBufferSource: () => node,
      createGain: () => gain,
    } as unknown as AudioContext
    const played = playBand(ctx, BUFFER, 4)
    expect(node.buffer).toBe(BUFFER)
    expect(node.connect).toHaveBeenCalledWith(gain)
    expect(gain.connect).toHaveBeenCalledWith(output.bus)
    played.stop()
    played.stop()
    expect(events).toEqual([
      'start at 5.00',
      'cancel',
      'hold',
      'ramp 0 at 5.06',
      'stop at 5.06',
    ])
  })
})
