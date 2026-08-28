import { describe, expect, it, vi } from 'vitest'
import { randomPhaseS, scheduleDyad } from './dyad-synth'

function fakeContext() {
  const oscillators: Array<{
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    onended: null | (() => void)
    type: string
  }> = []
  const gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      linearRampToValueAtTime: ReturnType<typeof vi.fn>
      cancelScheduledValues: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []
  const ctx = {
    currentTime: 2,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
      }
      oscillators.push(osc)
      return osc
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    }),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators, gains }
}

describe('dyad-synth', () => {
  it('starts two sines, the second early by the phase offset, at the caller level', () => {
    const { ctx, oscillators, gains } = fakeContext()
    scheduleDyad(ctx, 3, {
      hzA: 220,
      hzB: 221,
      lenS: 1.4,
      gainLevel: 0.5,
      phaseS: 0.001,
    })
    expect(oscillators).toHaveLength(2)
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(220, 3)
    expect(oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      221,
      2.999,
    )
    expect(oscillators[0].start).toHaveBeenCalledWith(3)
    expect(oscillators[1].start).toHaveBeenCalledWith(2.999)
    for (const gain of gains) {
      // Closed until `at`, then the attack to peak × level.
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 3)
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.13, 3.02)
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 4.4)
    }
    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenCalledWith(4.41)
    }
  })

  it('cancel silences both tones once and tears them down on end', () => {
    const { ctx, oscillators, gains } = fakeContext()
    const dyad = scheduleDyad(ctx, 3, { hzA: 220, hzB: 220, lenS: 1 })
    dyad.cancel()
    dyad.cancel()
    for (const gain of gains) {
      expect(gain.gain.cancelScheduledValues).toHaveBeenCalledTimes(1)
      expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 2)
    }
    for (const osc of oscillators) {
      expect(osc.stop).toHaveBeenLastCalledWith(2)
      osc.onended?.()
      expect(osc.disconnect).toHaveBeenCalledTimes(1)
    }
  })

  it('keeps the random phase inside a quarter cycle either way', () => {
    expect(randomPhaseS(200, () => 0)).toBeCloseTo(-0.00125)
    expect(randomPhaseS(200, () => 1)).toBeCloseTo(0.00125)
    expect(randomPhaseS(200, () => 0.5)).toBe(0)
  })
})
