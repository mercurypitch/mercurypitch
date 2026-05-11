// ============================================================
// Live Pitch Analysis Tests — Phase 1 & 2 real-time metrics
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LivePitchSample } from '@/lib/live-pitch-analysis'
import { analyzeLiveBuffer, approximateBreathiness, approximateResonance, approximateRichness, detectSlides, detectVibrato, intensityFromPitchResults, } from '@/lib/live-pitch-analysis'

// ── Helpers ──────────────────────────────────────────────────

function makeSample(overrides: Partial<LivePitchSample> = {}): LivePitchSample {
  return {
    frequency: 440,
    clarity: 0.9,
    amplitude: 0.5,
    noteName: 'A4',
    timestamp: 0,
    ...overrides,
  }
}

function makeSinePitchContour(
  baseFreq: number,
  modFreq: number,
  modDepth: number,
  duration: number,
  samplesPerSec = 60,
): LivePitchSample[] {
  const count = Math.floor(duration * samplesPerSec)
  const result: LivePitchSample[] = []
  for (let i = 0; i < count; i++) {
    const t = i / samplesPerSec
    const freq = baseFreq + Math.sin(2 * Math.PI * modFreq * t) * modDepth
    result.push(
      makeSample({
        frequency: freq,
        clarity: 0.8,
        amplitude: 0.5,
        timestamp: t,
        noteName: 'A4',
      }),
    )
  }
  return result
}

// ── Intensity ────────────────────────────────────────────────

describe('intensityFromPitchResults', () => {
  it('returns empty defaults for empty input', () => {
    const result = intensityFromPitchResults([])
    expect(result.avgDb).toBe(-60)
    expect(result.peakDb).toBe(-60)
    expect(result.dynamicRange).toBe(0)
    expect(result.isConsistent).toBe(false)
  })

  it('computes dB from amplitude', () => {
    const samples = [
      makeSample({ amplitude: 0.5 }), // -6 dB
      makeSample({ amplitude: 1.0 }), // 0 dB
    ]
    const result = intensityFromPitchResults(samples)
    expect(result.peakDb).toBeCloseTo(0, 0)
    expect(result.avgDb).toBeLessThan(0)
    expect(result.dynamicRange).toBeGreaterThan(0)
  })

  it('detects consistent intensity', () => {
    const samples = Array.from({ length: 50 }, () =>
      makeSample({ amplitude: 0.5 }),
    )
    const result = intensityFromPitchResults(samples)
    expect(result.isConsistent).toBe(true)
  })

  it('detects inconsistent intensity with varied amplitudes', () => {
    const samples = [
      makeSample({ amplitude: 0.1 }),
      makeSample({ amplitude: 0.9 }),
      makeSample({ amplitude: 0.1 }),
      makeSample({ amplitude: 0.9 }),
    ]
    const result = intensityFromPitchResults(samples)
    expect(result.dynamicRange).toBeGreaterThan(10)
  })
})

// ── Breathiness ──────────────────────────────────────────────

describe('approximateBreathiness', () => {
  it('returns clear for empty input', () => {
    const result = approximateBreathiness([])
    expect(result.score).toBe(0)
    expect(result.label).toBe('Clear')
    expect(result.hasGoodClosure).toBe(true)
  })

  it('returns low score for high clarity + high amplitude', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.9, amplitude: 0.7 }),
    )
    const result = approximateBreathiness(samples)
    expect(result.score).toBeLessThan(20)
    expect(result.label).toBe('Clear')
    expect(result.hasGoodClosure).toBe(true)
  })

  it('returns high score for low clarity', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.3, amplitude: 0.15 }),
    )
    const result = approximateBreathiness(samples)
    expect(result.score).toBeGreaterThan(40)
    expect(result.score).toBeLessThan(65)
    expect(result.label).toBe('Breathy')
  })

  it('returns Very Breathy for extremely low clarity', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.05, amplitude: 0.03 }),
    )
    const result = approximateBreathiness(samples)
    expect(result.label).toBe('Very Breathy')
    expect(result.score).toBeGreaterThan(60)
  })
})

// ── Slide Detection ──────────────────────────────────────────

describe('detectSlides', () => {
  it('returns empty for too few samples', () => {
    const result = detectSlides([])
    expect(result.count).toBe(0)
    expect(result.avgDistance).toBe(0)
  })

  it('returns empty when no pitch transitions', () => {
    const samples = Array.from({ length: 10 }, (_, i) =>
      makeSample({ frequency: 440, timestamp: i / 60 }),
    )
    const result = detectSlides(samples)
    expect(result.count).toBe(0)
  })

  it('detects slides between notes', () => {
    const samples = [
      makeSample({ frequency: 440, timestamp: 0, clarity: 0.8 }),
      makeSample({ frequency: 466.16, timestamp: 0.02, clarity: 0.8 }), // A#4 - 1 semitone
      makeSample({ frequency: 493.88, timestamp: 0.04, clarity: 0.8 }), // B4 - 1 semitone
      makeSample({ frequency: 523.25, timestamp: 0.06, clarity: 0.8 }), // C5 - 1 semitone
    ]
    const result = detectSlides(samples)
    expect(result.count).toBeGreaterThan(0)
    expect(result.avgDistance).toBeGreaterThan(0)
  })

  it('ignores unvoiced samples (freq=0)', () => {
    const samples = [
      makeSample({ frequency: 0, timestamp: 0 }),
      makeSample({ frequency: 440, timestamp: 0.02, clarity: 0.8 }),
      makeSample({ frequency: 0, timestamp: 0.04 }),
      makeSample({ frequency: 523.25, timestamp: 0.06, clarity: 0.8 }),
    ]
    const result = detectSlides(samples)
    // Only the 440→523 transition should count (if gap < 12 semitones)
    // Actually only 2 voiced samples, so not enough for a slide
    expect(result.count === 0 || result.count === 1).toBe(true)
  })

  it('ignores slides larger than 12 semitones', () => {
    const samples = [
      makeSample({ frequency: 220, timestamp: 0, clarity: 0.8 }),
      makeSample({ frequency: 880, timestamp: 0.02, clarity: 0.8 }), // 2 octaves
    ]
    const result = detectSlides(samples)
    expect(result.count).toBe(0)
  })
})

// ── Vibrato Detection ───────────────────────────────────────

describe('detectVibrato', () => {
  it('returns no vibrato for empty samples', () => {
    const result = detectVibrato([])
    expect(result.detected).toBe(false)
    expect(result.quality).toBe('None')
  })

  it('returns no vibrato for flat pitch', () => {
    const samples = Array.from({ length: 50 }, (_, i) =>
      makeSample({ frequency: 440, timestamp: i / 60 }),
    )
    const result = detectVibrato(samples)
    expect(result.detected).toBe(false)
  })

  it('detects vibrato from sinusoidal pitch modulation', () => {
    // 440 Hz with 5 Hz modulation, 30 cent depth, 2 seconds
    const samples = makeSinePitchContour(440, 5, 15, 2)
    const result = detectVibrato(samples)
    // Should detect vibrato from the oscillation
    expect(result.detected).toBe(true)
    expect(result.rate).toBeGreaterThan(2)
    expect(result.rate).toBeLessThan(10)
    expect(result.depth).toBeGreaterThan(0)
    expect(['Good', 'Wide', 'Wobbly', 'Narrow']).toContain(result.quality)
  })

  it('handles very short buffers', () => {
    const samples = [makeSample({ frequency: 440 })]
    const result = detectVibrato(samples)
    expect(result.detected).toBe(false)
  })
})

// ── Harmonic Richness ────────────────────────────────────────

describe('approximateRichness', () => {
  it('returns thin for empty samples', () => {
    const result = approximateRichness([])
    expect(result.score).toBe(0)
    expect(result.label).toBe('Thin')
    expect(result.harmonicCount).toBe(0)
  })

  it('returns higher score for high clarity + amplitude', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.9, amplitude: 0.8 }),
    )
    const result = approximateRichness(samples)
    expect(result.score).toBeGreaterThan(40)
    expect(result.label).not.toBe('Thin')
  })

  it('returns low score for weak signal', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.1, amplitude: 0.02 }),
    )
    const result = approximateRichness(samples)
    expect(result.score).toBeLessThan(30)
  })

  it('returns Full label for very strong signal', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ clarity: 0.95, amplitude: 0.9 }),
    )
    const result = approximateRichness(samples)
    expect(result.label).toBe('Full')
  })
})

// ── Resonance Zone Detection ─────────────────────────────────

describe('approximateResonance', () => {
  it('returns chest defaults for empty samples', () => {
    const result = approximateResonance([])
    expect(result.zone).toBe('Chest')
    expect(result.confidence).toBe(0)
    expect(result.avgFrequency).toBe(0)
  })

  it('detects chest voice for low frequencies', () => {
    const samples = Array.from(
      { length: 30 },
      () => makeSample({ frequency: 200 }), // ~G3
    )
    const result = approximateResonance(samples)
    expect(result.zone).toBe('Chest')
    expect(result.confidence).toBeGreaterThan(30)
  })

  it('detects head voice for high frequencies', () => {
    const samples = Array.from(
      { length: 30 },
      () => makeSample({ frequency: 600 }), // ~D5
    )
    const result = approximateResonance(samples)
    expect(result.zone).toBe('Head')
  })

  it('detects whistle for very high frequencies', () => {
    const samples = Array.from({ length: 30 }, () =>
      makeSample({ frequency: 1200 }),
    )
    const result = approximateResonance(samples)
    expect(result.zone).toBe('Whistle')
  })
})

// ── Convenience: analyzeLiveBuffer ───────────────────────────

describe('analyzeLiveBuffer', () => {
  it('returns all metrics from sample buffer', () => {
    const samples = makeSinePitchContour(440, 5, 15, 2)
    const snapshot = analyzeLiveBuffer(samples)

    expect(snapshot.sampleCount).toBe(samples.length)
    expect(snapshot.intensity).toBeDefined()
    expect(snapshot.breathiness).toBeDefined()
    expect(snapshot.slides).toBeDefined()
    expect(snapshot.vibrato).toBeDefined()
    expect(snapshot.richness).toBeDefined()
    expect(snapshot.resonance).toBeDefined()

    expect(typeof snapshot.intensity.avgDb).toBe('number')
    expect(typeof snapshot.breathiness.score).toBe('number')
    expect(typeof snapshot.slides.count).toBe('number')
    expect(typeof snapshot.vibrato.rate).toBe('number')
    expect(typeof snapshot.richness.score).toBe('number')
    expect(typeof snapshot.resonance.zone).toBe('string')
  })

  it('handles empty buffer gracefully', () => {
    const snapshot = analyzeLiveBuffer([])
    expect(snapshot.sampleCount).toBe(0)
    // Should not throw — all sub-analyzers handle empty input
    expect(snapshot.intensity).toBeDefined()
    expect(snapshot.breathiness).toBeDefined()
    expect(snapshot.vibrato).toBeDefined()
    expect(snapshot.richness).toBeDefined()
    expect(snapshot.resonance).toBeDefined()
  })
})
