// ============================================================
// Mic Insights tests — detector-aligned input warning policy
// ============================================================

import { describe, expect, it } from 'vitest'
import { classifyMicSignal } from '@/features/mic-feedback/useMicInsights'

describe('classifyMicSignal', () => {
  it('does not warn before playback starts', () => {
    expect(
      classifyMicSignal({
        isPlaying: false,
        isDetecting: false,
        level: 0.2,
        minAmplitude: 0.01,
      }),
    ).toBe('none')
  })

  it('does not call strong unpitched input too weak', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.2,
        minAmplitude: 0.01,
      }),
    ).toBe('none')
  })

  it('reports only input below the detector gate as too quiet', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.015,
        minAmplitude: 0.02,
      }),
    ).toBe('too-quiet')
  })

  it('distinguishes silence and clears as soon as pitch is detected', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0,
      }),
    ).toBe('no-input')
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: true,
        level: 0,
      }),
    ).toBe('none')
  })
})
