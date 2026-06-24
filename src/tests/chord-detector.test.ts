// ============================================================
// Chord Detector Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeNNLSChroma, detectChords, simplifyChordSequence, } from '@/lib/chord-detector'

describe('computeNNLSChroma', () => {
  it('returns 12-bin chroma', () => {
    const spectrum = new Float32Array(128).fill(1)
    const result = computeNNLSChroma(spectrum, 44100, 256)
    expect(result).toHaveLength(12)
    expect(result).toBeInstanceOf(Float32Array)
  })

  it('normalizes to unit sum', () => {
    const spectrum = new Float32Array(128).fill(5)
    const result = computeNNLSChroma(spectrum, 44100, 256)
    const total = result.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 2)
  })

  it('emphasizes pitch class of a pure tone', () => {
    const spectrum = new Float32Array(256)
    // A4 = 440 Hz → bin at 256 * 440 / 22050 ≈ 5
    spectrum[5] = 100
    const result = computeNNLSChroma(spectrum, 44100, 512)
    expect(result[9]).toBeGreaterThan(0.3) // A is pitch class 9
  })
})

describe('detectChords', () => {
  it('detects C major from C-major-weighted chroma', () => {
    // Build chroma frames with strong C, E, G
    const frames: Float32Array[] = []
    for (let f = 0; f < 5; f++) {
      const c = new Float32Array(12)
      c[0] = 0.5 // C
      c[4] = 0.3 // E
      c[7] = 0.2 // G
      frames.push(c)
    }
    const chords = detectChords(frames, 0.05)
    expect(chords.length).toBeGreaterThan(0)
    expect(chords[0].root).toBe('C')
    expect(chords[0].quality).toBe('major')
  })

  it('detects A minor from A-minor-weighted chroma', () => {
    const frames: Float32Array[] = []
    for (let f = 0; f < 5; f++) {
      const c = new Float32Array(12)
      c[9] = 0.5 // A
      c[0] = 0.3 // C
      c[4] = 0.2 // E
      frames.push(c)
    }
    const chords = detectChords(frames, 0.05)
    expect(chords.length).toBeGreaterThan(0)
    // Should match minor quality (A minor or similar)
    expect(chords.some((ch) => ch.quality === 'minor')).toBe(true)
  })

  it('returns empty for no frames', () => {
    expect(detectChords([], 0.05)).toHaveLength(0)
  })

  it('temporal smoothing reduces flicker', () => {
    const frames: Float32Array[] = []
    // Alternating C major and G major every frame
    for (let f = 0; f < 20; f++) {
      const c = new Float32Array(12)
      if (f % 2 === 0) {
        c[0] = 0.5
        c[4] = 0.3
        c[7] = 0.2
      } // C
      else {
        c[7] = 0.5
        c[11] = 0.3
        c[2] = 0.2
      } // G
      frames.push(c)
    }
    const chords = detectChords(frames, 0.05, { medianWindow: 5 })
    // With median 5 smoothing, should produce fewer changes
    expect(chords.length).toBeLessThan(frames.length)
  })
})

describe('simplifyChordSequence', () => {
  it('removes consecutive duplicates', () => {
    const chords = [
      {
        time: 0,
        chord: 'C',
        root: 'C',
        quality: 'major' as const,
        confidence: 0.9,
      },
      {
        time: 0.5,
        chord: 'C',
        root: 'C',
        quality: 'major' as const,
        confidence: 0.9,
      },
      {
        time: 1.0,
        chord: 'G',
        root: 'G',
        quality: 'major' as const,
        confidence: 0.8,
      },
      {
        time: 1.5,
        chord: 'G',
        root: 'G',
        quality: 'major' as const,
        confidence: 0.8,
      },
      {
        time: 2.0,
        chord: 'Am',
        root: 'A',
        quality: 'minor' as const,
        confidence: 0.85,
      },
    ]
    const simplified = simplifyChordSequence(chords)
    expect(simplified).toHaveLength(3)
    expect(simplified[0].chord).toBe('C')
    expect(simplified[1].chord).toBe('G')
    expect(simplified[2].chord).toBe('Am')
  })

  it('returns original for single chord', () => {
    const chords = [
      {
        time: 0,
        chord: 'C',
        root: 'C',
        quality: 'major' as const,
        confidence: 0.9,
      },
    ]
    expect(simplifyChordSequence(chords)).toHaveLength(1)
  })
})
