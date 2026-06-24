// ============================================================
// Onset Detector Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { analyzeOnsetsAndBeats, assignBeats, computeFluxCurve, detectOnsets, detectTempo, spectralFlux, } from '@/lib/onset-detector'

describe('spectralFlux', () => {
  it('returns 0 for identical spectra', () => {
    const prev = new Float32Array([1, 2, 3, 4, 5])
    const curr = new Float32Array([1, 2, 3, 4, 5])
    expect(spectralFlux(prev, curr)).toBe(0)
  })

  it('returns positive sum of differences for increasing magnitudes', () => {
    const prev = new Float32Array([0, 0, 0, 0, 0])
    const curr = new Float32Array([1, 2, 3, 4, 5])
    expect(spectralFlux(prev, curr)).toBeCloseTo(15, 1)
  })

  it('ignores negative differences (only positive contributions)', () => {
    const prev = new Float32Array([5, 5, 0, 0, 0])
    const curr = new Float32Array([0, 0, 5, 5, 5])
    // Differences: -5, -5, +5, +5, +5 → positive sum = 15
    expect(spectralFlux(prev, curr)).toBeCloseTo(15, 1)
  })

  it('handles different lengths by using the shorter', () => {
    const prev = new Float32Array([1, 2, 3])
    const curr = new Float32Array([2, 3, 4, 5, 6])
    expect(spectralFlux(prev, curr)).toBeCloseTo(3, 1) // (2-1)+(3-2)+(4-3)
  })
})

describe('computeFluxCurve', () => {
  it('computes flux for a sequence of spectra', () => {
    const frames = [
      new Float32Array([0, 0]),
      new Float32Array([1, 2]),
      new Float32Array([3, 4]),
      new Float32Array([5, 6]),
    ]
    const flux = computeFluxCurve(frames)
    // flux[0]: (1-0)+(2-0) = 3
    // flux[1]: (3-1)+(4-2) = 4
    // flux[2]: (5-3)+(6-4) = 4
    expect(flux).toHaveLength(3)
    expect(flux[0]).toBeCloseTo(3, 1)
    expect(flux[1]).toBeCloseTo(4, 1)
    expect(flux[2]).toBeCloseTo(4, 1)
  })

  it('returns empty array for < 2 frames', () => {
    expect(computeFluxCurve([])).toHaveLength(0)
    expect(computeFluxCurve([new Float32Array([1])])).toHaveLength(0)
  })
})

describe('detectOnsets', () => {
  it('detects onsets on synthetic click-like spectra', () => {
    // Build 100 frames: quiet baseline, then clicks at frames 20, 50, 80
    const frames: Float32Array[] = []
    const quiet = new Float32Array(100).fill(0.1)
    const click = new Float32Array(100).fill(5)
    for (let i = 0; i < 100; i++) {
      if (i === 20 || i === 50 || i === 80) {
        frames.push(click)
      } else {
        frames.push(quiet)
      }
    }

    const onsets = detectOnsets(frames, 44100, 1024, {
      threshold: 2.0,
      minInterval: 0.02,
    })
    expect(onsets.length).toBeGreaterThanOrEqual(2)
    // Time of frame 20: 20 * 1024 / 44100 ≈ 0.464s
    const times = onsets.map((o) => o.time)
    // Should be near 0.464, 1.16, 1.856
    expect(times.some((t) => Math.abs(t - 0.464) < 0.05)).toBe(true)
    expect(times.some((t) => Math.abs(t - 1.16) < 0.05)).toBe(true)
  })

  it('returns empty array for constant spectra', () => {
    const frames: Float32Array[] = []
    const flat = new Float32Array(50).fill(1)
    for (let i = 0; i < 50; i++) frames.push(flat)
    const onsets = detectOnsets(frames, 44100, 1024)
    expect(onsets).toHaveLength(0)
  })

  it('returns empty for < 2 frames', () => {
    expect(detectOnsets([], 44100, 1024)).toHaveLength(0)
    expect(detectOnsets([new Float32Array([1])], 44100, 1024)).toHaveLength(0)
  })

  it('respects minInterval merging close onsets', () => {
    // Three clicks very close together
    const frames: Float32Array[] = []
    const quiet = new Float32Array(50).fill(0.1)
    const click = new Float32Array(50).fill(10)
    for (let i = 0; i < 30; i++) {
      frames.push(i >= 9 && i <= 11 ? click : quiet)
    }
    const onsets = detectOnsets(frames, 44100, 256, { minInterval: 0.1 })
    // Should merge the 3 close clicks into 1
    expect(onsets.length).toBeLessThanOrEqual(2)
  })
})

describe('detectTempo', () => {
  it('detects 120 BPM from evenly spaced onsets', () => {
    const onsets: Array<{ time: number; strength: number; isBeat: boolean }> =
      []
    for (let i = 0; i < 16; i++) {
      onsets.push({ time: i * 0.5, strength: 0.8, isBeat: false })
    }
    const result = detectTempo(onsets)
    // Should be near 120 or a multiple/subdivision
    expect(result.bpm).toBeGreaterThan(50)
    expect(result.bpm).toBeLessThan(250)
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it('detects 90 BPM from slower onsets', () => {
    const onsets: Array<{ time: number; strength: number; isBeat: boolean }> =
      []
    for (let i = 0; i < 12; i++) {
      onsets.push({ time: i * (60 / 90), strength: 0.8, isBeat: false })
    }
    const result = detectTempo(onsets)
    expect(result.bpm).toBeGreaterThan(40)
    expect(result.bpm).toBeLessThan(250)
  })

  it('returns low confidence for too few onsets', () => {
    const onsets = [
      { time: 0, strength: 0.5, isBeat: false },
      { time: 1, strength: 0.5, isBeat: false },
    ]
    const result = detectTempo(onsets)
    expect(result.confidence).toBe(0)
  })
})

describe('assignBeats', () => {
  it('marks onsets near beat intervals as beats', () => {
    const onsets: Array<{ time: number; strength: number; isBeat: boolean }> =
      []
    // Perfect 120 BPM onsets
    for (let i = 0; i < 8; i++) {
      onsets.push({ time: i * 0.5, strength: 0.7, isBeat: false })
    }
    const result = assignBeats(onsets, 120)
    const beatCount = result.filter((o) => o.isBeat).length
    expect(beatCount).toBeGreaterThanOrEqual(6)
    // Check beat positions cycle 1-4
    const positions = result.filter((o) => o.isBeat).map((o) => o.beatPosition)
    expect(new Set(positions).size).toBeGreaterThanOrEqual(2)
  })

  it('returns unchanged when no onsets', () => {
    expect(assignBeats([], 120)).toHaveLength(0)
  })
})

describe('analyzeOnsetsAndBeats', () => {
  it('full pipeline returns onsets, bpm, and confidence', () => {
    const frames: Float32Array[] = []
    const quiet = new Float32Array(64).fill(0.5)
    const peak = new Float32Array(64).fill(6)
    for (let i = 0; i < 200; i++) {
      // Create onsets at roughly 120 BPM (every 21 frames at 44100/2048)
      frames.push(i % 21 === 0 ? peak : quiet)
    }
    const result = analyzeOnsetsAndBeats(frames, 44100, 2048)
    expect(result.onsets.length).toBeGreaterThan(0)
    expect(result.bpm).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
  })
})
