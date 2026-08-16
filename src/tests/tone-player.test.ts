// ============================================================
// Tone player — the guide-tone bus and the reference tone's wiring
// ============================================================
//
// The Zen guide used to connect every cue straight to the destination and
// close() the context mid-tone — several 0.32-peak tones in one frame
// clipped, and the close was a full-scale cut (a confirmed pop source on a
// PA). The bus + deferred close now live here as pure graph builders so
// those two failure shapes are pinned by test instead of by ear.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeGuideToneBus, createGuideToneBus, playReferenceTone, } from '@/features/mirror/tone-player'

interface FakeParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
}

const fakeParam = (value = 0): FakeParam => ({
  value,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
})

const fakeNode = () => ({ connect: vi.fn(), disconnect: vi.fn() })

function fakeContext() {
  const compressors: Array<ReturnType<typeof fakeCompressor>> = []
  const gains: Array<ReturnType<typeof fakeGain>> = []
  const oscillators: Array<ReturnType<typeof fakeOscillator>> = []

  function fakeCompressor() {
    return {
      ...fakeNode(),
      threshold: fakeParam(),
      knee: fakeParam(),
      ratio: fakeParam(),
      attack: fakeParam(),
      release: fakeParam(),
    }
  }

  function fakeGain() {
    return { ...fakeNode(), gain: fakeParam(1) }
  }

  function fakeOscillator() {
    return {
      ...fakeNode(),
      frequency: fakeParam(),
      type: 'sine',
      onended: null as (() => void) | null,
      setPeriodicWave: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  const ctx = {
    currentTime: 5,
    state: 'running',
    destination: fakeNode(),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createDynamicsCompressor: vi.fn(() => {
      const c = fakeCompressor()
      compressors.push(c)
      return c
    }),
    createGain: vi.fn(() => {
      const g = fakeGain()
      gains.push(g)
      return g
    }),
    createOscillator: vi.fn(() => {
      const o = fakeOscillator()
      oscillators.push(o)
      return o
    }),
    createBiquadFilter: vi.fn(() => ({
      ...fakeNode(),
      type: 'lowpass',
      frequency: fakeParam(),
      Q: fakeParam(),
    })),
    createPeriodicWave: vi.fn(() => ({})),
  }
  return { ctx, compressors, gains, oscillators }
}

describe('createGuideToneBus', () => {
  it('builds gain → limiter → destination with the pinned limiter curve', () => {
    const { ctx, compressors, gains } = fakeContext()
    const bus = createGuideToneBus(ctx as unknown as AudioContext)

    const limiter = compressors[0]!
    expect(limiter.threshold.value).toBe(-12)
    expect(limiter.knee.value).toBe(20)
    expect(limiter.ratio.value).toBe(12)
    expect(limiter.attack.value).toBe(0.002)
    expect(limiter.release.value).toBe(0.15)
    expect(limiter.connect).toHaveBeenCalledWith(ctx.destination)

    expect(bus).toBe(gains[0])
    expect(gains[0]!.gain.value).toBe(0.8)
    expect(gains[0]!.connect).toHaveBeenCalledWith(limiter)
  })
})

describe('closeGuideToneBus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('releases the bus with the documented shape, then closes the context after the tail', () => {
    const { ctx } = fakeContext()
    const bus = createGuideToneBus(ctx as unknown as AudioContext)
    closeGuideToneBus(ctx as unknown as AudioContext, bus)

    const gain = (bus as unknown as { gain: FakeParam }).gain
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(5)
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.8, 5)
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(0, 5, 0.03)

    // The context must outlive the longest tone tail.
    expect(ctx.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1599)
    expect(ctx.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ctx.close).toHaveBeenCalledOnce()
  })

  it('still closes the context when there is no bus', () => {
    const { ctx } = fakeContext()
    closeGuideToneBus(ctx as unknown as AudioContext, null)
    vi.advanceTimersByTime(1600)
    expect(ctx.close).toHaveBeenCalledOnce()
  })

  it('survives a bus whose context is already gone, and a rejecting close', async () => {
    const { ctx } = fakeContext()
    ctx.close.mockRejectedValue(new Error('already closed'))
    const bus = createGuideToneBus(ctx as unknown as AudioContext)
    ;(bus as unknown as { gain: FakeParam }).gain.cancelScheduledValues = vi
      .fn()
      .mockImplementation(() => {
        throw new DOMException('closed')
      })
    expect(() =>
      closeGuideToneBus(ctx as unknown as AudioContext, bus),
    ).not.toThrow()
    vi.advanceTimersByTime(1600)
    await Promise.resolve() // the rejection must be swallowed, not unhandled
    expect(ctx.close).toHaveBeenCalledOnce()
  })
})

describe('playReferenceTone routing', () => {
  it('connects to the destination when no bus is given', () => {
    const { ctx, gains, oscillators } = fakeContext()
    void playReferenceTone(ctx as unknown as AudioContext, 69, 1)
    expect(gains[0]!.connect).toHaveBeenCalledWith(ctx.destination)
    expect(oscillators[0]!.frequency.value).toBeCloseTo(440, 5)
    expect(oscillators[0]!.stop).toHaveBeenCalledWith(6) // now 5 + 1s
  })

  it('routes through the given bus instead of the raw destination', () => {
    const { ctx, gains } = fakeContext()
    const bus = { connect: vi.fn(), disconnect: vi.fn() }
    void playReferenceTone(
      ctx as unknown as AudioContext,
      69,
      1,
      bus as unknown as AudioNode,
    )
    expect(gains[0]!.connect).toHaveBeenCalledWith(bus)
    expect(gains[0]!.connect).not.toHaveBeenCalledWith(ctx.destination)
  })

  it('resolves and tears the graph down when the tone ends', async () => {
    const { ctx, gains, oscillators } = fakeContext()
    const done = playReferenceTone(ctx as unknown as AudioContext, 60, 1)
    oscillators[0]!.onended!()
    await done
    expect(oscillators[0]!.disconnect).toHaveBeenCalled()
    expect(gains[0]!.disconnect).toHaveBeenCalled()
  })

  it('resumes a suspended context so the tone can sound at all', () => {
    const { ctx } = fakeContext()
    ctx.state = 'suspended'
    void playReferenceTone(ctx as unknown as AudioContext, 60, 1)
    expect(ctx.resume).toHaveBeenCalled()
  })
})
