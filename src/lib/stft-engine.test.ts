// ============================================================
// STFT Engine Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { periodicHannWindow, stftForward, stftInverse } from './stft-engine'

function createSineBuffer(
  sampleRate: number,
  frequency: number,
  durationSec: number,
  amplitude = 1.0,
): Float32Array {
  const samples = Math.floor(sampleRate * durationSec)
  const buffer = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('periodicHannWindow', () => {
  it('has correct length', () => {
    const w = periodicHannWindow(6142)
    expect(w.length).toBe(6142)
  })

  it('starts and ends near zero (periodic)', () => {
    const w = periodicHannWindow(6142)
    expect(w[0]).toBe(0)
    // Periodic: last element should be 0.5*(1 - cos(2π*(N-1)/N)) ≈ very small
    expect(w[6141]).toBeCloseTo(0, 5)
  })

  it('is symmetric when last element is zero', () => {
    const w = periodicHannWindow(1024)
    // w[n] should ≈ w[N-n] for n > 0 since periodic Hann wraps
    for (let i = 1; i < 512; i++) {
      expect(w[i]).toBeCloseTo(w[1024 - i], 5)
    }
  })

  it('peak is at nFft/2 and equals 1.0', () => {
    const w = periodicHannWindow(1024)
    expect(w[512]).toBeCloseTo(1.0, 5)
  })

  it('all values between 0 and 1', () => {
    const w = periodicHannWindow(6142)
    for (let i = 0; i < w.length; i++) {
      expect(w[i]).toBeGreaterThanOrEqual(0)
      expect(w[i]).toBeLessThanOrEqual(1)
    }
  })
})

describe('stftForward', () => {
  it('returns correct output shape for power-of-2 nFft', () => {
    const audio = createSineBuffer(44100, 440, 1.0)
    const result = stftForward(audio, 1024, 256)
    expect(result.nFft).toBe(1024)
    expect(result.hopLength).toBe(256)
    expect(result.nFreq).toBe(513) // 1024/2 + 1
    expect(result.nFrames).toBeGreaterThan(0)
    expect(result.data.length).toBe(result.nFreq * result.nFrames * 2)
  })

  it(
    'returns correct output shape for non-power-of-2 nFft (6142)',
    { timeout: 15000 },
    () => {
      const audio = createSineBuffer(44100, 440, 6.0)
      const result = stftForward(audio, 6142, 1024)
      expect(result.nFft).toBe(6142)
      expect(result.nFreq).toBe(3072) // 6142/2 + 1
      expect(result.nFrames).toBeGreaterThan(0)
      expect(result.data.length).toBe(3072 * result.nFrames * 2)
    },
  )

  it(
    'produces exactly 256 frames for 261120 samples (nFft=6142, hop=1024)',
    { timeout: 15000 },
    () => {
      // With center=True: paddedLen = 261120 + 6142 = 267262
      // nFrames = (267262 - 6142) / 1024 + 1 = 261120/1024 + 1 = 255 + 1 = 256
      const audio = new Float32Array(261120)
      const result = stftForward(audio, 6142, 1024)
      expect(result.nFrames).toBe(256)
    },
  )

  it('detects frequency peak in spectrogram for pure sine', () => {
    const sineFreq = 440
    const sampleRate = 44100
    const nFft = 2048
    const audio = createSineBuffer(sampleRate, sineFreq, 0.5)
    const result = stftForward(audio, nFft, 512)

    // Find the bin with max magnitude in the first frame
    const binWidth = sampleRate / nFft
    const expectedBin = Math.round(sineFreq / binWidth)
    let maxMag = 0
    let maxBin = -1
    for (let f = 0; f < result.nFreq; f++) {
      const real = result.data[f * 2]
      const imag = result.data[f * 2 + 1]
      const mag = Math.sqrt(real * real + imag * imag)
      if (mag > maxMag) {
        maxMag = mag
        maxBin = f
      }
    }

    expect(maxBin).toBeGreaterThan(0)
    expect(Math.abs(maxBin - expectedBin)).toBeLessThanOrEqual(2)
  })

  it('produces nonzero magnitudes for sine input', () => {
    const audio = createSineBuffer(44100, 440, 1.0)
    const result = stftForward(audio, 1024, 256)

    // At least some bins should have nonzero energy
    let totalEnergy = 0
    for (let i = 0; i < result.data.length; i++) {
      totalEnergy += Math.abs(result.data[i])
    }
    expect(totalEnergy).toBeGreaterThan(0)
  })

  it('handles very short input (shorter than nFft)', () => {
    const audio = createSineBuffer(44100, 440, 0.01) // ~441 samples
    const result = stftForward(audio, 6142, 1024)
    expect(result.nFrames).toBe(1)
    expect(result.data.length).toBe(3072 * 2)
  })

  it('handles empty input', () => {
    const audio = new Float32Array(0)
    const result = stftForward(audio, 1024, 256)
    expect(result.nFrames).toBe(1)
  })

  it('handles silence (all zeros)', () => {
    const audio = new Float32Array(44100)
    const result = stftForward(audio, 1024, 256)
    // Should not throw, all magnitudes should be near zero
    for (let i = 0; i < result.data.length; i++) {
      expect(result.data[i]).toBeCloseTo(0, 5)
    }
  })
})

describe('stftInverse', () => {
  it('roundtrips audio through STFT → iSTFT (power-of-2)', () => {
    const audio = createSineBuffer(44100, 440, 2.0)
    const nFft = 1024
    const hopLen = 256

    const stft = stftForward(audio, nFft, hopLen)
    const reconstructed = stftInverse(stft, audio.length)

    expect(reconstructed.length).toBe(audio.length)

    // Check reconstruction accuracy on a segment (skip edges due to windowing)
    const margin = nFft
    let maxError = 0
    let sumSqError = 0
    let sumSqOrig = 0
    for (let i = margin; i < audio.length - margin; i++) {
      const err = Math.abs(audio[i] - reconstructed[i])
      maxError = Math.max(maxError, err)
      sumSqError += err * err
      sumSqOrig += audio[i] * audio[i]
    }

    const rmsError = Math.sqrt(sumSqError / (audio.length - 2 * margin))
    const rmsOrig = Math.sqrt(sumSqOrig / (audio.length - 2 * margin))
    // RMS error should be less than 5% of RMS original
    expect(rmsError / rmsOrig).toBeLessThan(0.05)
    expect(maxError).toBeLessThan(0.1)
  })

  it(
    'roundtrips audio through STFT → iSTFT (non-power-of-2, nFft=6142)',
    { timeout: 25000 },
    () => {
      const audio = createSineBuffer(44100, 440, 6.0) // need enough frames for 6142
      const nFft = 6142
      const hopLen = 1024

      const stft = stftForward(audio, nFft, hopLen)
      const reconstructed = stftInverse(stft, audio.length)

      expect(reconstructed.length).toBe(audio.length)

      // Check reconstruction accuracy
      const margin = nFft
      let maxError = 0
      let sumSqError = 0
      let sumSqOrig = 0
      for (let i = margin; i < audio.length - margin; i++) {
        const err = Math.abs(audio[i] - reconstructed[i])
        maxError = Math.max(maxError, err)
        sumSqError += err * err
        sumSqOrig += audio[i] * audio[i]
      }

      const rmsError = Math.sqrt(sumSqError / (audio.length - 2 * margin))
      const rmsOrig = Math.sqrt(sumSqOrig / (audio.length - 2 * margin))
      expect(rmsError / rmsOrig).toBeLessThan(0.08)
      expect(maxError).toBeLessThan(0.15)
    },
  )

  it('preserves original length when specified', () => {
    const audio = createSineBuffer(44100, 440, 1.0)
    const stft = stftForward(audio, 1024, 256)
    const reconstructed = stftInverse(stft, audio.length)
    expect(reconstructed.length).toBe(audio.length)
  })

  it('produces consistent output on repeated calls', () => {
    const audio = createSineBuffer(44100, 440, 0.5)
    const stft = stftForward(audio, 1024, 256)
    const r1 = stftInverse(stft, audio.length)
    const r2 = stftInverse(stft, audio.length)

    expect(r1.length).toBe(r2.length)
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i]).toBeCloseTo(r2[i], 7)
    }
  })

  it('handles single-frame STFT', () => {
    // Short enough audio that only one frame fits (with center padding)
    const audio = createSineBuffer(44100, 440, 0.005) // ~220 samples < hopLength
    const stft = stftForward(audio, 1024, 256)
    expect(stft.nFrames).toBe(1)
    const reconstructed = stftInverse(stft, audio.length)
    expect(reconstructed.length).toBe(audio.length)
  })
})

describe('Bluestein DFT edge cases', () => {
  it(
    'handles nFft=6142 correctly (frame count for typical audio)',
    { timeout: 15000 },
    () => {
      // 6 seconds @ 44100 = 264600 samples
      const audio = createSineBuffer(44100, 440, 6.0)
      const stft = stftForward(audio, 6142, 1024)

      // With center padding: (264600 + 6142 - 6142) / 1024 + 1 = 264600/1024 + 1 ≈ 259
      const expectedFrames = Math.floor(264600 / 1024) + 1
      expect(stft.nFrames).toBe(expectedFrames)

      // Each frame has 3072 freq bins × 2 (real+imag) = 6144 values
      expect(stft.data.length).toBe(3072 * expectedFrames * 2)
    },
  )

  it('handles odd nFft (if ever needed)', () => {
    const audio = createSineBuffer(44100, 440, 0.5)
    // nFft=1025 is odd - Bluestein handles this
    const stft = stftForward(audio, 1025, 256)
    expect(stft.nFft).toBe(1025)
    expect(stft.nFreq).toBe(Math.floor(1025 / 2) + 1)
    expect(stft.nFrames).toBeGreaterThan(0)
  })

  it('handles prime nFft (worst case for radix-2 FFTs)', () => {
    const audio = createSineBuffer(44100, 440, 0.5)
    // 1031 is prime, requires Bluestein
    const stft = stftForward(audio, 1031, 256)
    expect(stft.nFft).toBe(1031)
    expect(stft.nFrames).toBeGreaterThan(0)

    // Should still roundtrip approximately
    const reconstructed = stftInverse(stft, audio.length)
    expect(reconstructed.length).toBe(audio.length)
  })
})
