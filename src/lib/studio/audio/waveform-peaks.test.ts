// Studio waveform peaks tests — real amplitude and silence, a level every eight times coarser, a checked stored form.
import { describe, expect, it } from 'vitest'
import { buildStudioPeaks, decodeStudioPeaks, encodeStudioPeaks, STUDIO_PEAK_FRAMES, STUDIO_PEAK_LEVEL_STEP, studioPeakLevel, studioPeaksByteLength, } from './waveform-peaks'

const SHA = 'c'.repeat(64)
const value = (peaks: ReturnType<typeof buildStudioPeaks>, stored: number) =>
  stored * peaks.scale

describe('Studio waveform peaks', () => {
  it('keeps actual stereo amplitude and silence at 256 frames a peak', () => {
    const left = new Float32Array(20_000)
    const right = new Float32Array(20_000)
    left[600] = -0.25
    right[600] = 0.5
    const peaks = buildStudioPeaks([left, right], left.length)
    const [base] = peaks.levels
    expect(base.framesPerPeak).toBe(STUDIO_PEAK_FRAMES)
    expect(base.minima).toHaveLength(Math.ceil(20_000 / 256))
    // Frame 600 is in peak 2; everything else is silence.
    expect(value(peaks, base.minima[2])).toBeCloseTo(-0.25, 4)
    expect(value(peaks, base.maxima[2])).toBeCloseTo(0.5, 4)
    expect(base.maxima[0]).toBe(0)
    expect(base.rms[0]).toBe(0)
    expect(value(peaks, base.rms[2])).toBeGreaterThan(0)
    expect(value(peaks, base.rms[2])).toBeLessThanOrEqual(0.5)
  })

  it('stacks levels eight times coarser up to a single peak, each holding the extremes below it', () => {
    const samples = Float32Array.from(
      { length: 300_000 },
      (_, frame) => 0.4 * Math.sin(frame / 50),
    )
    samples[123_456] = 0.9
    const peaks = buildStudioPeaks([samples], samples.length)
    const sizes = peaks.levels.map((level) => level.framesPerPeak)
    expect(sizes[0]).toBe(256)
    for (let level = 1; level < sizes.length; level++)
      expect(sizes[level]).toBe(sizes[level - 1] * STUDIO_PEAK_LEVEL_STEP)
    expect(peaks.levels.at(-1)!.minima).toHaveLength(1)
    for (const level of peaks.levels) {
      const loudest = Math.max(...level.maxima)
      expect(value(peaks, loudest)).toBeCloseTo(0.9, 4)
    }
  })

  it('keeps samples past full scale instead of clipping them', () => {
    const samples = new Float32Array(1000)
    samples[10] = 1.5
    samples[20] = -0.75
    const peaks = buildStudioPeaks([samples], samples.length)
    expect(value(peaks, Math.max(...peaks.levels[0].maxima))).toBeCloseTo(
      1.5,
      4,
    )
    expect(value(peaks, Math.min(...peaks.levels[0].minima))).toBeCloseTo(
      -0.75,
      4,
    )
  })

  it('refuses a sample that is not a finite number', () => {
    const samples = new Float32Array(1000)
    samples[700] = Number.NaN
    expect(() => buildStudioPeaks([samples], samples.length)).toThrow(
      'This audio contains invalid samples.',
    )
  })

  it('reads back what it stored, and only for the same audio', () => {
    const samples = Float32Array.from(
      { length: 50_000 },
      (_, frame) => 0.3 * Math.sin(frame / 7),
    )
    const peaks = buildStudioPeaks([samples], samples.length)
    const bytes = encodeStudioPeaks(peaks, SHA)
    expect(bytes.byteLength).toBe(studioPeaksByteLength(samples.length))
    const same = {
      normalizedFrameCount: samples.length,
      canonicalPcmSha256: SHA,
    }
    const back = decodeStudioPeaks(bytes, same)!
    expect(back.scale).toBe(peaks.scale)
    expect(back.levels.map((level) => [...level.maxima])).toEqual(
      peaks.levels.map((level) => [...level.maxima]),
    )
    expect(
      decodeStudioPeaks(bytes, { ...same, canonicalPcmSha256: 'd'.repeat(64) }),
    ).toBeNull()
    expect(
      decodeStudioPeaks(bytes, { ...same, normalizedFrameCount: 49_999 }),
    ).toBeNull()
    expect(
      decodeStudioPeaks(bytes.slice(0, bytes.byteLength - 2), same),
    ).toBeNull()
    expect(decodeStudioPeaks(new ArrayBuffer(12), same)).toBeNull()
  })

  it('draws from the coarsest level that still has a peak for every column', () => {
    const samples = new Float32Array(3_000_000)
    const peaks = buildStudioPeaks([samples], samples.length)
    expect(studioPeakLevel(peaks, 100).framesPerPeak).toBe(256)
    expect(studioPeakLevel(peaks, 2047).framesPerPeak).toBe(256)
    expect(studioPeakLevel(peaks, 2048).framesPerPeak).toBe(2048)
    expect(studioPeakLevel(peaks, 200_000).framesPerPeak).toBe(131_072)
  })
})
