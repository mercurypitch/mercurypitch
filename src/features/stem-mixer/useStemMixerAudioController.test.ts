// ============================================================
// StemMixer audio activation — detector-valid live pitch gate
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { isSupportedLiveMicPitch } from './useStemMixerAudioController'

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
