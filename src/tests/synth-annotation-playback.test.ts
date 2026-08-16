// ============================================================
// Annotation tones — cues that neither click on start nor pop on stop
// ============================================================
//
// Each annotation instant sounds a short sine cue. The attack used to be a
// zero-length jump to full gain (a click on every cue) and stop() cut the
// sources at sounding gain (a full-scale discontinuity). Both shapes are
// pinned here per the pop-free envelope doc.

import { describe, expect, it, vi } from 'vitest'
import { scheduleAnnotationTones } from '@/lib/synth-annotation-playback'

const fakeParam = (value = 0) => ({
  value,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
})

function fakeContext(currentTime = 10) {
  const gains: Array<{
    gain: ReturnType<typeof fakeParam>
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []
  const oscillators: Array<{
    type: string
    frequency: { value: number }
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }> = []
  const ctx = {
    currentTime,
    destination: {},
    createGain: vi.fn(() => {
      const g = { gain: fakeParam(0.15), connect: vi.fn(), disconnect: vi.fn() }
      gains.push(g)
      return g
    }),
    createOscillator: vi.fn(() => {
      const o = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(o)
      return o
    }),
  }
  return { ctx, gains, oscillators }
}

describe('scheduleAnnotationTones', () => {
  it('opens every cue from the exponential floor, never a step to full gain', () => {
    const { ctx, gains, oscillators } = fakeContext(10)
    scheduleAnnotationTones(ctx as unknown as AudioContext, [
      { time: 2, label: 'MIDI:69' },
    ])
    const g = gains[0]!.gain
    // Attack: floor at the start instant, then an exponential ramp up…
    expect(g.setValueAtTime).toHaveBeenCalledWith(0.0001, 12)
    expect(g.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(
      1,
      0.15,
      12.02,
    )
    // …and an exponential decay to near-floor by the end of the tone.
    expect(g.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(
      2,
      0.001,
      12.1,
    )
    expect(oscillators[0]!.frequency.value).toBeCloseTo(440, 5)
    // The source outlives the decay by a hair, never the other way round.
    expect(oscillators[0]!.stop).toHaveBeenCalledWith(12.11)
  })

  it('honours custom duration, gain and fallback frequency', () => {
    const { ctx, gains, oscillators } = fakeContext(0)
    scheduleAnnotationTones(
      ctx as unknown as AudioContext,
      [{ time: 1, label: 'not a pitch' }],
      { toneDuration: 0.5, gain: 0.3, defaultHz: 220 },
    )
    expect(oscillators[0]!.frequency.value).toBe(220)
    const g = gains[0]!.gain
    // Attack cap: min(0.02, duration * 0.2) = 0.02 for a 0.5s tone.
    expect(g.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(1, 0.3, 1.02)
    expect(g.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(
      2,
      0.001,
      1.5,
    )
  })

  it('reads note names, flats and explicit Hz from the label', () => {
    const { ctx, oscillators } = fakeContext(0)
    scheduleAnnotationTones(ctx as unknown as AudioContext, [
      { time: 1, label: 'A4' },
      { time: 2, label: 'Bb3' },
      { time: 3, label: '441 Hz' },
    ])
    expect(oscillators[0]!.frequency.value).toBeCloseTo(440, 5)
    expect(oscillators[1]!.frequency.value).toBeCloseTo(233.08, 1)
    expect(oscillators[2]!.frequency.value).toBe(441)
  })

  it('skips instants already in the past', () => {
    const { ctx, oscillators } = fakeContext(10)
    scheduleAnnotationTones(ctx as unknown as AudioContext, [
      { time: -1 },
      { time: 1 },
    ])
    expect(oscillators).toHaveLength(1)
  })

  it('stop() ramps every gain down before the sources cut', () => {
    const { ctx, gains, oscillators } = fakeContext(10)
    const handle = scheduleAnnotationTones(ctx as unknown as AudioContext, [
      { time: 1, label: 'A4' },
      { time: 2, label: 'C4' },
    ])
    ctx.currentTime = 11
    handle.stop()
    for (const g of gains) {
      // Anchor the held value, then the documented release — never a cut.
      expect(g.gain.cancelScheduledValues).toHaveBeenCalledWith(11)
      expect(g.gain.setValueAtTime).toHaveBeenCalledWith(0.15, 11)
      expect(g.gain.setTargetAtTime).toHaveBeenCalledWith(0, 11, 0.006)
      expect(g.disconnect).toHaveBeenCalled()
    }
    for (const o of oscillators) {
      // 0.05s ≈ 8τ past the release start: below audibility before the cut.
      expect(o.stop).toHaveBeenLastCalledWith(11.05)
    }
  })

  it('stop() survives nodes whose context has already gone away', () => {
    const { ctx, gains, oscillators } = fakeContext(10)
    const handle = scheduleAnnotationTones(ctx as unknown as AudioContext, [
      { time: 1 },
    ])
    gains[0]!.gain.cancelScheduledValues.mockImplementation(() => {
      throw new DOMException('closed')
    })
    oscillators[0]!.stop.mockImplementation(() => {
      throw new DOMException('already stopped')
    })
    expect(() => handle.stop()).not.toThrow()
    expect(gains[0]!.disconnect).toHaveBeenCalled()
  })
})
