// ============================================================
// DTW Aligner Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { alignAudioBuffers, alignRecordings, bufferToChroma, cosineDistance, } from '@/lib/dtw-aligner'

describe('cosineDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([1, 0, 0])
    expect(cosineDistance(a, b)).toBeCloseTo(0, 2)
  })

  it('returns ~1 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(cosineDistance(a, b)).toBeCloseTo(1, 2)
  })

  it('returns ~2 for opposite vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([-1, 0, 0])
    expect(cosineDistance(a, b)).toBeCloseTo(2, 2)
  })

  it('returns 0 for zero vectors', () => {
    const a = new Float32Array([0, 0, 0])
    const b = new Float32Array([1, 2, 3])
    expect(cosineDistance(a, b)).toBe(0)
  })
})

describe('alignRecordings', () => {
  it('aligns identical chroma sequences with perfect score', () => {
    const chroma: Float32Array[] = []
    for (let i = 0; i < 10; i++) {
      const c = new Float32Array(12)
      c[i % 12] = 1
      chroma.push(c)
    }
    const result = alignRecordings(chroma, chroma)
    expect(result.similarityScore).toBeCloseTo(1, 1) // nearly perfect
    expect(result.tempoRatio).toBeCloseTo(1, 1)
    expect(result.timeMap).toHaveLength(chroma.length)
  })

  it('aligns time-stretched sequences', () => {
    const ref: Float32Array[] = []
    const user: Float32Array[] = []
    for (let i = 0; i < 20; i++) {
      const c = new Float32Array(12)
      c[i % 12] = 1
      ref.push(c)
    }
    for (let i = 0; i < 10; i++) {
      const c = new Float32Array(12)
      c[i % 12] = 1
      user.push(c)
    }
    const result = alignRecordings(ref, user)
    expect(result.timeMap).toHaveLength(user.length)
    expect(result.tempoRatio).toBeCloseTo(0.5, 1) // user is twice as fast → ratio < 1
  })

  it('handles empty input gracefully', () => {
    const result = alignRecordings([], [])
    expect(result.similarityScore).toBe(0)
    expect(result.timeMap).toHaveLength(0)
  })

  it('timeMap has one entry per user frame', () => {
    const ref: Float32Array[] = []
    const user: Float32Array[] = []
    for (let i = 0; i < 8; i++) ref.push(new Float32Array(12).fill(0.1))
    for (let i = 0; i < 6; i++) user.push(new Float32Array(12).fill(0.1))
    const result = alignRecordings(ref, user)
    expect(result.timeMap.length).toBe(user.length)
  })

  it('returns similarity between 0 and 1', () => {
    const a: Float32Array[] = [
      new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ]
    const b: Float32Array[] = [
      new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ]
    const result = alignRecordings(a, b)
    expect(result.similarityScore).toBeGreaterThanOrEqual(0)
    expect(result.similarityScore).toBeLessThanOrEqual(1)
  })
})

describe('bufferToChroma', () => {
  it('converts an audio buffer to chroma frames', () => {
    const buffer = new Float32Array(4096)
    // Generate a simple sine wave at 440 Hz
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.sin((2 * Math.PI * 440 * i) / 44100)
    }
    const frames = bufferToChroma(buffer, 44100, 2048, 1024)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames[0]).toHaveLength(12)
  })

  it('returns empty for buffer smaller than FFT size', () => {
    const buffer = new Float32Array(100)
    const frames = bufferToChroma(buffer, 44100, 2048, 1024)
    expect(frames).toHaveLength(0)
  })
})

describe('alignAudioBuffers', () => {
  it('aligns two simple buffers', () => {
    const ref = new Float32Array(8192)
    const user = new Float32Array(8192)
    for (let i = 0; i < ref.length; i++) {
      ref[i] = Math.sin((2 * Math.PI * 440 * i) / 44100)
      user[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.8
    }
    const result = alignAudioBuffers(ref, user, 44100, {
      bandWidth: 0.15,
      fftSize: 2048,
    })
    expect(result.similarityScore).toBeGreaterThan(0.5)
    expect(result.timeMap.length).toBeGreaterThan(0)
  })
})
