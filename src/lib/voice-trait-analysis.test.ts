// ============================================================
// Voice trait analysis tests — phrase gaps stay out of held-note metrics
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DecodedVoiceAtlasContour, VoiceAtlasPoint } from './voice-contour'
import { analyzeVoicePitchTraits, voiceContourFundamentalHz, } from './voice-trait-analysis'

function contour(points: VoiceAtlasPoint[]): DecodedVoiceAtlasContour {
  const voiced = points.filter((point) => point.midiCents !== null)
  return {
    version: 1,
    source: 'f0-stream-yin-v1',
    sampleRateHz: 30,
    points,
    pitchRange:
      voiced.length === 0
        ? null
        : [
            Math.min(...voiced.map((point) => point.midiCents!)),
            Math.max(...voiced.map((point) => point.midiCents!)),
          ],
    voicedRatio: points.length === 0 ? 0 : voiced.length / points.length,
  }
}

function vibratoPoints(): VoiceAtlasPoint[] {
  return Array.from({ length: 90 }, (_, index) => {
    const time = index / 30
    const cents = Math.round(6_000 + Math.sin(2 * Math.PI * 5.5 * time) * 25)
    return {
      timeMs: Math.round(time * 1000),
      midiCents: cents,
      confidence: 0.95,
      level: 0.7,
    }
  })
}

describe('analyzeVoicePitchTraits', () => {
  it('reuses the vocal vibrato detector on a continuous held region', () => {
    const result = analyzeVoicePitchTraits(contour(vibratoPoints()))

    expect(result?.vibrato.detected).toBe(true)
    expect(result?.vibrato.rateHz).toBeGreaterThanOrEqual(4)
    expect(result?.vibrato.rateHz).toBeLessThanOrEqual(7)
    expect(result?.heldWindowCount).toBeGreaterThan(0)
  })

  it('does not bridge silence and note changes into a false held region', () => {
    const points: VoiceAtlasPoint[] = [
      ...Array.from({ length: 10 }, (_, index) => ({
        timeMs: index * 33,
        midiCents: 6_000,
        confidence: 0.9,
        level: 0.6,
      })),
      { timeMs: 363, midiCents: null, confidence: 0, level: 0 },
      ...Array.from({ length: 10 }, (_, index) => ({
        timeMs: 396 + index * 33,
        midiCents: 6_400,
        confidence: 0.9,
        level: 0.6,
      })),
    ] satisfies VoiceAtlasPoint[]

    const result = analyzeVoicePitchTraits(contour(points))
    expect(result?.vibrato.detected).toBe(false)
    expect(result?.heldCenterSpreadCents).toBeNull()
  })

  it('reports no pitch traits when no contour was saved', () => {
    expect(analyzeVoicePitchTraits(null)).toBeNull()
  })
})

describe('voiceContourFundamentalHz', () => {
  it('uses the median confident pitch rather than uncertain outliers', () => {
    const result = voiceContourFundamentalHz(
      contour([
        { timeMs: 0, midiCents: 6_900, confidence: 0.9, level: 0.7 },
        { timeMs: 33, midiCents: 6_900, confidence: 0.9, level: 0.7 },
        { timeMs: 66, midiCents: 10_000, confidence: 0.2, level: 0.7 },
      ]),
    )

    expect(result).toBeCloseTo(440, 4)
  })
})
