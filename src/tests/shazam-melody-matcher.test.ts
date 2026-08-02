// ============================================================
// Shazam Sing — melody matcher
// ============================================================
//
// The matcher had no tests, and the confidence number it produced was
// not measuring what it claimed. Two separate faults:
//
//   1. Its distance function saturated (see shazam-dtw.test.ts), so all
//      four musical features returned ~1.0 for every reference and the
//      ranking fell through to the length bonus alone. Three unrelated
//      songs read "P:100 I:100 C:100 R:100".
//
//   2. Features with no data on either side score 0 and were still
//      billed at full weight, so a flawless match against a fingerprint
//      carrying no rhythm data was capped at 85%.
//
// These tests fix the meaning of the number: the right song must rank
// first, the wrong ones must not look certain, and a percentage must be
// comparable between two references that carry different features.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LivePitchContour, MelodyFingerprint } from '@/lib/shazam/types'

const fingerprints: MelodyFingerprint[] = []

vi.mock('@/lib/shazam/melody-fingerprints', () => ({
  getFingerprintArray: (): MelodyFingerprint[] => fingerprints,
}))

const { matchPitchContour } = await import('@/lib/shazam/melody-matcher')

// ── Fixtures ─────────────────────────────────────────────────

/** Build a fingerprint from a note sequence, filling the derived fields. */
function fingerprint(
  melodyId: string,
  name: string,
  notes: number[],
  opts: { secPerNote?: number; withRhythm?: boolean } = {},
): MelodyFingerprint {
  const secPerNote = opts.secPerNote ?? 0.5
  const intervals: number[] = []
  for (let i = 1; i < notes.length; i++) intervals.push(notes[i] - notes[i - 1])
  const iois =
    opts.withRhythm === false ? [] : notes.slice(1).map(() => secPerNote)
  return {
    melodyId,
    name,
    pitchSequence: notes,
    ioiSequence: iois,
    durations: notes.map(() => secPerNote),
    durationSec: notes.length * secPerNote,
    noteCount: notes.length,
    firstNoteStartSec: 0,
    chromaSequence: notes.map((n) => n % 12),
    intervalSequence: intervals,
    bpm: 120,
    key: 'C',
  }
}

/** Build a contour the way the live pitch buffer would hand one over. */
function contour(
  notes: number[],
  opts: { secPerNote?: number; withRhythm?: boolean } = {},
): LivePitchContour {
  const secPerNote = opts.secPerNote ?? 0.5
  return {
    frames: [],
    onsets: notes.map((_, i) => ({
      time: i * secPerNote,
      type: 'note-start' as const,
      confidence: 1,
    })),
    durationSec: notes.length * secPerNote,
    noteSequence: notes,
    ioiSequence:
      opts.withRhythm === false ? [] : notes.slice(1).map(() => secPerNote),
    noteDurations: notes.map(() => secPerNote),
  }
}

/** "Twinkle, twinkle, little star" — the phrase people actually sing at it. */
const TWINKLE = [60, 60, 67, 67, 69, 69, 67]
/** "Mary had a little lamb" — same key, different tune. */
const MARY = [64, 62, 60, 62, 64, 64, 64]
/** A descending run sharing neither shape nor register. */
const DESCENT = [79, 77, 76, 74, 72, 71, 69]

beforeEach(() => {
  fingerprints.length = 0
  localStorage.clear()
})

describe('ranking', () => {
  it('puts the song that was actually sung first', () => {
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Mary', MARY),
      fingerprint('m3', 'Descent', DESCENT),
    )
    const results = matchPitchContour(contour(TWINKLE))
    expect(results[0].name).toBe('Twinkle')
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence)
  })

  it('does not report the wrong songs as near-certain', () => {
    // THE REGRESSION the owner reported: every match came back 90+%.
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Mary', MARY),
      fingerprint('m3', 'Descent', DESCENT),
    )
    const results = matchPitchContour(contour(TWINKLE))
    const wrong = results.filter((r) => r.name !== 'Twinkle')
    expect(wrong.length).toBeGreaterThan(0)
    for (const r of wrong) expect(r.confidence).toBeLessThan(90)
  })

  it('scores an exact match at or near 100', () => {
    fingerprints.push(fingerprint('m1', 'Twinkle', TWINKLE))
    const [top] = matchPitchContour(contour(TWINKLE))
    expect(top.confidence).toBeGreaterThanOrEqual(97)
  })

  it('separates a transposed take from a different tune', () => {
    // Sung a fourth up. Interval and chroma should carry it; the result
    // must still beat an unrelated melody sung in the right register.
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Mary', MARY),
    )
    const results = matchPitchContour(contour(TWINKLE.map((n) => n + 5)))
    expect(results[0].name).toBe('Twinkle')
  })

  it('finds a phrase sung from the middle of a long reference', () => {
    const song = [...DESCENT, ...TWINKLE, ...MARY]
    fingerprints.push(
      fingerprint('m1', 'Long song', song),
      fingerprint('m2', 'Mary', MARY),
    )
    const results = matchPitchContour(contour(TWINKLE))
    expect(results[0].name).toBe('Long song')
  })
})

describe('the breakdown behind the number', () => {
  it('does not saturate every feature at once', () => {
    // Four measures agreeing perfectly on the WRONG song is the shape of
    // the original bug — it made the breakdown panel useless.
    fingerprints.push(fingerprint('m2', 'Mary', MARY))
    const [only] = matchPitchContour(contour(TWINKLE))
    const { pitchScore, intervalScore, chromaScore, rhythmScore } =
      only.breakdown
    const saturated = [
      pitchScore,
      intervalScore,
      chromaScore,
      rhythmScore,
    ].filter((s) => s > 0.99)
    expect(saturated.length).toBeLessThan(4)
  })

  it('rates interval higher than pitch for a transposed take', () => {
    fingerprints.push(fingerprint('m1', 'Twinkle', TWINKLE))
    const [top] = matchPitchContour(contour(TWINKLE.map((n) => n + 7)))
    expect(top.breakdown.intervalScore).toBeGreaterThan(
      top.breakdown.pitchScore,
    )
  })

  it('keeps every score inside 0..1 and confidence inside 0..100', () => {
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Descent', DESCENT),
    )
    for (const r of matchPitchContour(contour(MARY))) {
      for (const v of Object.values(r.breakdown)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(100)
    }
  })
})

describe('features that are simply absent', () => {
  it('does not dock a perfect match for a fingerprint with no rhythm data', () => {
    // Stem fingerprints can arrive without IOIs. Billing rhythm's weight
    // for data nobody has capped a flawless match at 85%.
    fingerprints.push(
      fingerprint('m1', 'No rhythm', TWINKLE, { withRhythm: false }),
    )
    const [top] = matchPitchContour(contour(TWINKLE, { withRhythm: false }))
    expect(top.confidence).toBeGreaterThanOrEqual(97)
  })

  it('scores the same match the same whether or not rhythm is present', () => {
    fingerprints.push(fingerprint('withR', 'With rhythm', TWINKLE))
    const withRhythm = matchPitchContour(contour(TWINKLE))[0].confidence
    fingerprints.length = 0
    fingerprints.push(
      fingerprint('noR', 'Without rhythm', TWINKLE, { withRhythm: false }),
    )
    const without = matchPitchContour(
      contour(TWINKLE, { withRhythm: false }),
    )[0].confidence
    expect(Math.abs(withRhythm - without)).toBeLessThanOrEqual(2)
  })

  it('handles a single-note query without crashing or claiming certainty', () => {
    fingerprints.push(fingerprint('m1', 'Twinkle', TWINKLE))
    const results = matchPitchContour(contour([60]))
    // A single note is not evidence of a melody; it may match or be
    // filtered out, but it must never come back as a confident hit.
    for (const r of results) expect(r.confidence).toBeLessThan(90)
  })

  it('returns nothing when the index is empty', () => {
    expect(matchPitchContour(contour(TWINKLE))).toEqual([])
  })
})

describe('matcher options', () => {
  it('honours minConfidence', () => {
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Descent', DESCENT),
    )
    const strict = matchPitchContour(contour(TWINKLE), { minConfidence: 95 })
    for (const r of strict) expect(r.confidence).toBeGreaterThanOrEqual(95)
    expect(strict.length).toBeLessThan(2)
  })

  it('honours maxResults', () => {
    for (let i = 0; i < 8; i++) {
      fingerprints.push(
        fingerprint(
          `m${i}`,
          `Song ${i}`,
          TWINKLE.map((n) => n + i),
        ),
      )
    }
    expect(matchPitchContour(contour(TWINKLE), { maxResults: 3 })).toHaveLength(
      3,
    )
  })

  it('filters by source', () => {
    fingerprints.push(
      fingerprint('m1', 'Library melody', TWINKLE),
      fingerprint('stem:abc', 'Uploaded stem', TWINKLE),
    )
    const stems = matchPitchContour(contour(TWINKLE), { sourceFilter: 'stem' })
    expect(stems.map((r) => r.name)).toEqual(['Uploaded stem'])
    expect(stems[0].source).toBe('stem')
    expect(stems[0].sessionId).toBe('abc')

    const melodies = matchPitchContour(contour(TWINKLE), {
      sourceFilter: 'melody',
    })
    expect(melodies.map((r) => r.name)).toEqual(['Library melody'])
  })

  it('returns results sorted by confidence', () => {
    fingerprints.push(
      fingerprint('m1', 'Twinkle', TWINKLE),
      fingerprint('m2', 'Mary', MARY),
      fingerprint('m3', 'Descent', DESCENT),
    )
    const results = matchPitchContour(contour(TWINKLE))
    const confidences = results.map((r) => r.confidence)
    expect([...confidences].sort((a, b) => b - a)).toEqual(confidences)
  })
})

describe('long queries', () => {
  // Over 60 notes the query is downsampled to bound the DTW matrices.
  // A slow arch survives that sampling; a dense chromatic run genuinely
  // does not, and should not pretend to.
  const ARCH = Array.from({ length: 90 }, (_, i) =>
    Math.round(60 + 12 * Math.sin((i / 89) * Math.PI)),
  )

  it('still recognises a melody whose shape survives the sampling', () => {
    fingerprints.push(
      fingerprint('m1', 'Arch', ARCH, { secPerNote: 0.2 }),
      fingerprint('m2', 'Descent', DESCENT),
    )
    const [top] = matchPitchContour(contour(ARCH, { secPerNote: 0.2 }))
    expect(top.name).toBe('Arch')
    expect(top.confidence).toBeGreaterThan(75)
  })

  it('keeps the sampled query rhythmic instead of flattening it', () => {
    // THE BUG: the old rebuild pushed `durationSec / noteCount` once per
    // gap, so every downsampled query arrived with a perfectly uniform
    // rhythm no matter how it was sung. A query that starts fast and
    // ends slow must still prefer the reference that does the same.
    const gaps = (n: number, fastFirst: boolean): number[] =>
      Array.from({ length: n - 1 }, (_, i) =>
        i < (n - 1) / 2 === fastFirst ? 0.15 : 0.6,
      )

    const swung = fingerprint('m1', 'Fast then slow', ARCH)
    swung.ioiSequence = gaps(ARCH.length, true)
    swung.durationSec = swung.ioiSequence.reduce((a, b) => a + b, 0)

    const inverted = fingerprint('m2', 'Slow then fast', ARCH)
    inverted.ioiSequence = gaps(ARCH.length, false)
    inverted.durationSec = inverted.ioiSequence.reduce((a, b) => a + b, 0)

    fingerprints.push(swung, inverted)

    const query = contour(ARCH)
    query.ioiSequence = gaps(ARCH.length, true)
    query.durationSec = query.ioiSequence.reduce((a, b) => a + b, 0)

    const results = matchPitchContour(query)
    const byName = new Map(results.map((r) => [r.name, r]))
    expect(byName.get('Fast then slow')!.breakdown.rhythmScore).toBeGreaterThan(
      byName.get('Slow then fast')!.breakdown.rhythmScore,
    )
    expect(results[0].name).toBe('Fast then slow')
  })

  it('keeps every score in range on a downsampled query', () => {
    const dense = Array.from({ length: 120 }, (_, i) => 60 + (i % 12))
    fingerprints.push(fingerprint('m1', 'Dense', dense, { secPerNote: 0.25 }))
    const [top] = matchPitchContour(contour(dense, { secPerNote: 0.25 }))
    expect(top).toBeDefined()
    for (const v of Object.values(top.breakdown)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('where the match sits in the reference', () => {
  it('reports an offset into a long reference, not the very start', () => {
    const song = [...DESCENT, ...DESCENT, ...TWINKLE]
    fingerprints.push(fingerprint('m1', 'Long song', song, { secPerNote: 0.5 }))
    const [top] = matchPitchContour(contour(TWINKLE))
    expect(top.matchOffsetSec).toBeGreaterThan(0)
  })
})
