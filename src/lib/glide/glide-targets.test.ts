// ============================================================
// Glide targets — Ng slides and Lip roll fitted to the singer's range
// ============================================================

import { describe, expect, it } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { NG_SLIDE_SEMITONES } from './glide-path'
import { fitLipRoll, fitNgSlides, ngRootsForRange } from './glide-targets'

function voiceprint(
  takenAt: string,
  lowMidi: number | null,
  highMidi: number | null,
): VoiceprintRecord {
  return {
    id: `vp-${takenAt}`,
    summary: {
      lowMidi,
      highMidi,
      semitones:
        lowMidi === null || highMidi === null ? null : highMidi - lowMidi,
      accuracy: 61,
      steadiness: 73,
    },
    twin: null,
    source: 'mirror',
    takenAt,
  }
}

const range = (low: number, high: number) => [
  voiceprint('2026-10-01T10:00:00Z', low, high),
]

describe('fitNgSlides', () => {
  it('climbs from 15 % up the span, on a natural note: C3 to C5 starts on E3', () => {
    // Act: 48 + 0.15 x 24 = 51.6, nearest natural E3 (52)
    const fit = fitNgSlides({ voiceprints: range(48, 72) })

    // Assert
    expect(fit).toEqual({
      roots: [52, 53, 54, 55, 56],
      semitones: 7,
      source: 'voiceprint',
    })
  })

  it('steps down from the top when root + 11 would pass 85 % of the span', () => {
    // Act: span 14; root D3 (50) + 11 = 61 > 48 + 11.9 = 59.9
    const fit = fitNgSlides({ voiceprints: range(48, 62) })

    // Assert: slide 1's top on B3 (59), the fifth slide the lowest
    expect(fit.roots).toEqual([52, 51, 50, 49, 48])
  })

  it('sings every slide on one root when the span is under 13 semitones', () => {
    // Act: 48 + 0.15 x 10 = 49.5, nearest natural D3 (50)
    const fit = fitNgSlides({ voiceprints: range(48, 58) })

    // Assert
    expect(fit.roots).toEqual([50, 50, 50, 50, 50])
  })

  it('keeps every note between the low end and 85 % of any span of 13 or more', () => {
    for (let low = 40; low <= 60; low++) {
      for (let span = 13; span <= 30; span++) {
        // Act
        const roots = ngRootsForRange({ low, high: low + span })

        // Assert
        const ceiling = low + 0.85 * span
        expect(Math.min(...roots)).toBeGreaterThanOrEqual(low)
        expect(Math.max(...roots) + NG_SLIDE_SEMITONES).toBeLessThanOrEqual(
          ceiling + 1e-9,
        )
        expect(new Set(roots).size).toBe(5)
      }
    }
  })

  it('reads the newest voiceprint', () => {
    // Act
    const fit = fitNgSlides({
      voiceprints: [
        voiceprint('2026-09-01T10:00:00Z', 40, 64),
        voiceprint('2026-10-01T10:00:00Z', 48, 72),
      ],
    })

    // Assert
    expect(fit.roots[0]).toBe(52)
  })

  it('without a voiceprint, roots four under the settled note', () => {
    // Act
    const fit = fitNgSlides({ voiceprints: [], settledMidi: 55.3 })

    // Assert
    expect(fit).toEqual({
      roots: [51, 52, 53, 54, 55],
      semitones: 7,
      source: 'settled',
    })
  })

  it('last of all, roots four under the voice type note, tenor by default', () => {
    // Act
    const tenor = fitNgSlides({ voiceprints: [] })
    const bass = fitNgSlides({ voiceprints: [], voicePreset: 'bass' })

    // Assert: tenor's note is E3 (52)
    expect(tenor.roots[0]).toBe(48)
    expect(tenor.source).toBe('preset')
    expect(bass.roots[0]).toBe(getComfortableMidiRange('bass').default - 4)
  })
})

describe('a range wider than two octaves', () => {
  it('places Lip roll and Ng slides in its practice range: F2 to D5 starts both on D3', () => {
    // Act: F2 (41) to D5 (74), a slide that dipped into a growl. Placed from
    // F2, both began on A2; the practice range is B2 (47) to B4 (71).
    const lip = fitLipRoll({ voiceprints: range(41, 74) })
    const ng = fitNgSlides({ voiceprints: range(41, 74) })

    // Assert: 47 + 2.4 = 49.4 and 47 + 3.6 = 50.6, both nearest D3 (50).
    expect(lip.roots).toEqual([50, 52, 54])
    expect(ng.roots).toEqual([50, 51, 52, 53, 54])
  })
})

describe('fitLipRoll', () => {
  it('rolls an octave from 10 % up the span, waves 2 and 3 two and four higher', () => {
    // Act: G2 to G4; 43 + 2.4 = 45.4, nearest natural A2 (45)
    const fit = fitLipRoll({ voiceprints: range(43, 67) })

    // Assert: the highest crest, 61, stays under 43 + 22.8
    expect(fit).toEqual({
      roots: [45, 47, 49],
      semitones: 12,
      source: 'voiceprint',
    })
  })

  it('keeps all three waves on the root when the highest crest would pass 95 %', () => {
    // Act: span 16; 48 + 1.6 = 49.6 -> D3 (50); 50 + 4 + 12 = 66 >= 63.2
    const fit = fitLipRoll({ voiceprints: range(48, 64) })

    // Assert
    expect(fit.roots).toEqual([50, 50, 50])
    expect(fit.semitones).toBe(12)
  })

  it('lowers the crest to the span less two semitones under a 14-semitone span', () => {
    // Act: span 12; 48 + 1.2 = 49.2 -> D3 (50); crest 10 up
    const fit = fitLipRoll({ voiceprints: range(48, 60) })

    // Assert
    expect(fit.semitones).toBe(10)
    expect(fit.roots).toEqual([50, 50, 50])
  })

  it('without a voiceprint, three waves four under the comfortable note', () => {
    // Act
    const settled = fitLipRoll({ voiceprints: [], settledMidi: 55 })
    const preset = fitLipRoll({ voiceprints: [] })

    // Assert: the crest about eight over the comfortable note
    expect(settled).toEqual({
      roots: [51, 51, 51],
      semitones: 12,
      source: 'settled',
    })
    expect(preset.roots).toEqual([48, 48, 48])
    expect(preset.source).toBe('preset')
  })
})
