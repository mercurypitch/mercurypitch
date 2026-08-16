// ============================================================
// StemMixer audio activation — detector-valid live pitch gate
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { closeStemGain, isSupportedLiveMicPitch, STEM_STOP_SLACK_SECS, } from './useStemMixerAudioController'

function pitch(frequency: number): DetectedPitch {
  return {
    frequency,
    clarity: 0.9,
    noteName: 'A',
    octave: 4,
    cents: 0,
  }
}

describe('isSupportedLiveMicPitch', () => {
  it('accepts a finite detector pitch in the scorer singing range', () => {
    expect(isSupportedLiveMicPitch(pitch(440))).toBe(true)
  })

  it('rejects silence, invalid values, and detector output outside the scoring range', () => {
    expect(isSupportedLiveMicPitch(null)).toBe(false)
    expect(isSupportedLiveMicPitch(pitch(0))).toBe(false)
    expect(isSupportedLiveMicPitch(pitch(Number.NaN))).toBe(false)
    expect(isSupportedLiveMicPitch(pitch(20))).toBe(false)
    expect(isSupportedLiveMicPitch(pitch(5000))).toBe(false)
  })
})

describe('closeStemGain', () => {
  const param = (value = 0.9) => ({
    value,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  })

  it('anchors the held value and decays asymptotically — never a linear cut', () => {
    const gain = param(0.9)
    closeStemGain(gain as unknown as AudioParam, 4, 0.05)
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(4)
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.9, 4)
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(0, 4, 0.05 / 5)
  })

  it('gives the release room before the source stops', () => {
    // fade + slack ≈ 5τ + 3τ: the scheduled stop lands far below -40 dB.
    expect(STEM_STOP_SLACK_SECS).toBeCloseTo(0.03)
  })

  it('tolerates a gain whose context is already gone', () => {
    const gain = param()
    gain.cancelScheduledValues.mockImplementation(() => {
      throw new DOMException('closed')
    })
    expect(() =>
      closeStemGain(gain as unknown as AudioParam, 4, 0.05),
    ).not.toThrow()
  })
})
