// ============================================================
// Live waveform visual tests — honest, readable signal amplification
// ============================================================

import { describe, expect, it } from 'vitest'
import { liveWaveformDisplayGain, liveWaveformLaneLayout, liveWaveformPeak, liveWaveformSample, } from './live-waveform-visuals'

describe('live waveform visuals', () => {
  it('leaves digital silence perfectly flat', () => {
    const data = new Uint8Array([128, 128, 128, 128])
    expect(liveWaveformPeak(data)).toBe(0)
    expect(liveWaveformSample(128, liveWaveformDisplayGain(0))).toBe(0)
  })

  it('amplifies quiet real movement without inventing a signal', () => {
    const data = new Uint8Array([128, 132, 124, 130])
    const peak = liveWaveformPeak(data)
    const gain = liveWaveformDisplayGain(peak)

    expect(peak).toBeCloseTo(4 / 128)
    expect(gain).toBeGreaterThan(1)
    expect(Math.abs(liveWaveformSample(132, gain))).toBeGreaterThan(4 / 128)
  })

  it('caps the display while preserving the sample direction', () => {
    expect(liveWaveformSample(255, 8)).toBe(1)
    expect(liveWaveformSample(0, 8)).toBe(-1)
  })

  it('keeps stem labels out of the waveform drawing area', () => {
    const desktop = liveWaveformLaneLayout(600)
    const narrow = liveWaveformLaneLayout(100)

    expect(desktop.labelRailWidth).toBe(112)
    expect(desktop.waveformStartX).toBeGreaterThan(desktop.labelRailWidth)
    expect(desktop.waveformWidth).toBeGreaterThan(400)
    expect(narrow.labelRailWidth).toBeGreaterThanOrEqual(40)
    expect(narrow.waveformWidth).toBeGreaterThanOrEqual(42)
  })
})
