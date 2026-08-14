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

describe('detectChords — the minimum-duration gate', () => {
  // The gate exists to absorb chords that flicker past too briefly to be real.
  // It compared the incoming frame time against `(merged.length - 1) * hop` —
  // the previous segment's INDEX in the output array — rather than the start it
  // actually stored. Because merging collapses runs, that index trails the
  // frame index badly, so the computed duration grew far larger than the truth
  // and the gate passed almost everything through.

  const chroma = (weights: Record<number, number>): Float32Array => {
    const c = new Float32Array(12)
    for (const [bin, value] of Object.entries(weights)) c[Number(bin)] = value
    return c
  }

  const C = chroma({ 0: 0.5, 4: 0.3, 7: 0.2 })
  const G = chroma({ 7: 0.5, 11: 0.3, 2: 0.2 })

  /** n frames of a, then one frame of b, then n frames of a again. */
  const withBlip = (a: Float32Array, b: Float32Array, run: number) => [
    ...Array.from({ length: run }, () => a),
    b,
    ...Array.from({ length: run }, () => a),
  ]

  it('drops a one-frame chord that is far shorter than minDuration', () => {
    const hop = 0.05
    // A single 50 ms blip against a 1 s minimum. Whatever else the detector
    // decides, that blip must not survive as its own segment.
    const chords = detectChords(withBlip(C, G, 20), hop, {
      medianWindow: 1,
      minDuration: 1,
    })

    const durations = chords.map((c, i) =>
      i + 1 < chords.length ? chords[i + 1].time - c.time : Infinity,
    )
    // No emitted segment may be shorter than the minimum it was filtered on.
    expect(durations.filter((d) => d < 1)).toHaveLength(0)
  })

  it('reports segment starts that increase and match the frame grid', () => {
    const hop = 0.05
    const chords = detectChords(withBlip(C, G, 10), hop, { medianWindow: 1 })

    for (let i = 1; i < chords.length; i++) {
      expect(chords[i].time).toBeGreaterThan(chords[i - 1].time)
    }
    for (const c of chords) {
      // Every start is a real frame boundary, not an array index scaled by hop.
      expect(Math.round(c.time / hop) * hop).toBeCloseTo(c.time, 10)
    }
  })

  it('still emits a genuine chord change that outlasts the minimum', () => {
    // The negative control: a gate that dropped everything would satisfy the
    // first case while destroying the feature.
    const hop = 0.05
    const chords = detectChords(
      [
        ...Array.from({ length: 20 }, () => C),
        ...Array.from({ length: 20 }, () => G),
      ],
      hop,
      { medianWindow: 1, minDuration: 0.25 },
    )
    expect(chords.length).toBeGreaterThanOrEqual(2)
  })
})
