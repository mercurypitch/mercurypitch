// ============================================================
// Audio Chunker Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeChunkRanges, crossfadeWindows, overlapAdd, UVR_CHUNK_CONFIG } from './audio-chunker'

function createSineBuffer(length: number, frequency: number, sampleRate: number): Float32Array {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('computeChunkRanges', () => {
  it('produces single chunk for short audio', () => {
    // genSize = 253440 — audio shorter than this fits in one chunk
    const ranges = computeChunkRanges(80000, UVR_CHUNK_CONFIG)
    expect(ranges.length).toBe(1)
    expect(ranges[0].start).toBe(0)
    expect(ranges[0].end).toBe(UVR_CHUNK_CONFIG.chunkSize)
  })

  it('produces multiple chunks for long audio', () => {
    // 60 seconds @ 44100 = 2,646,000 samples
    const audioLen = 44100 * 60
    const ranges = computeChunkRanges(audioLen, UVR_CHUNK_CONFIG)
    expect(ranges.length).toBeGreaterThan(1)

    // First chunk starts at 0
    expect(ranges[0].start).toBe(0)

    // Chunks are spaced by genSize
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start - ranges[i - 1].start).toBe(UVR_CHUNK_CONFIG.genSize)
    }
  })

  it('chunks cover full audio range', () => {
    const audioLen = 44100 * 5
    const ranges = computeChunkRanges(audioLen, UVR_CHUNK_CONFIG)
    // Last chunk should extend past audio end
    expect(ranges[ranges.length - 1].end).toBeGreaterThanOrEqual(audioLen)
  })

  it('all chunks have correct size', () => {
    const ranges = computeChunkRanges(44100 * 10, UVR_CHUNK_CONFIG)
    for (const r of ranges) {
      expect(r.end - r.start).toBeLessThanOrEqual(UVR_CHUNK_CONFIG.chunkSize)
    }
  })

  it('returns at least one chunk for zero-length audio', () => {
    const ranges = computeChunkRanges(0, UVR_CHUNK_CONFIG)
    expect(ranges.length).toBeGreaterThanOrEqual(1)
  })
})

describe('crossfadeWindows', () => {
  it('produces correct length windows', () => {
    const { fadeIn, fadeOut } = crossfadeWindows(100)
    expect(fadeIn.length).toBe(100)
    expect(fadeOut.length).toBe(100)
  })

  it('fadeIn starts at 0 and ends near 1', () => {
    const { fadeIn } = crossfadeWindows(100)
    expect(fadeIn[0]).toBeCloseTo(0, 1)
    expect(fadeIn[99]).toBeCloseTo(1, 1)
  })

  it('fadeOut starts near 1 and ends near 0', () => {
    const { fadeOut } = crossfadeWindows(100)
    expect(fadeOut[0]).toBeCloseTo(1, 1)
    expect(fadeOut[99]).toBeCloseTo(0, 1)
  })

  it('fadeIn + fadeOut = 1 everywhere', () => {
    const { fadeIn, fadeOut } = crossfadeWindows(100)
    for (let i = 0; i < 100; i++) {
      expect(fadeIn[i] + fadeOut[i]).toBeCloseTo(1, 7)
    }
  })

  it('handles trim=3840 (default UVR)', () => {
    const { fadeIn, fadeOut } = crossfadeWindows(3840)
    expect(fadeIn.length).toBe(3840)
    expect(fadeIn[0] + fadeOut[0]).toBeCloseTo(1, 7)
  })
})

describe('overlapAdd', () => {
  it('reconstructs signal from non-overlapping chunks', () => {
    const config = { chunkSize: 100, trim: 0, genSize: 100 }
    const original = createSineBuffer(300, 440, 44100)
    const chunks = [
      original.slice(0, 100),
      original.slice(100, 200),
      original.slice(200, 300),
    ]
    const result = overlapAdd(chunks, 300, config)

    expect(result.length).toBe(300)
    for (let i = 0; i < 300; i++) {
      expect(result[i]).toBeCloseTo(original[i], 5)
    }
  })

  it('handles single chunk', () => {
    const config = { chunkSize: 100, trim: 0, genSize: 100 }
    const chunk = createSineBuffer(50, 440, 44100)
    const result = overlapAdd([chunk], 50, config)

    expect(result.length).toBe(50)
    for (let i = 0; i < 50; i++) {
      expect(result[i]).toBeCloseTo(chunk[i], 5)
    }
  })

  it('handles overlapping chunks with trim', () => {
    const config = { chunkSize: 100, trim: 20, genSize: 80 }
    const original = createSineBuffer(260, 440, 44100)
    const chunks = [
      original.slice(0, 100),
      original.slice(80, 180),
      original.slice(160, 260),
    ]
    const result = overlapAdd(chunks, 260, config)

    expect(result.length).toBe(260)
    // Overlap region should still approximate original (averaged)
    // Near the middle, away from boundaries, should be close
    for (let i = 30; i < 230; i++) {
      expect(Math.abs(result[i] - original[i])).toBeLessThan(0.1)
    }
  })

  it('uses UVR_CHUNK_CONFIG without error', () => {
    const config = UVR_CHUNK_CONFIG
    const audio = createSineBuffer(44100 * 2, 440, 44100)
    const ranges = computeChunkRanges(audio.length, config)
    const chunks = ranges.map(r => audio.slice(r.start, Math.min(r.end, audio.length)))
    // Pad last chunk if needed
    const lastChunk = chunks[chunks.length - 1]
    if (lastChunk.length < config.chunkSize) {
      const padded = new Float32Array(config.chunkSize)
      padded.set(lastChunk)
      chunks[chunks.length - 1] = padded
    }
    const result = overlapAdd(chunks, audio.length, config)
    expect(result.length).toBe(audio.length)
  })
})
