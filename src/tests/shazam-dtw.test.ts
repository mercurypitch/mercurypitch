// ============================================================
// Shazam Sing — DTW
// ============================================================
//
// This module had no tests, and it shipped a bug that made every
// recognition read 90-100%: the subsequence matcher offered a free
// restart on EVERY query note, not just the first, so the accumulated
// cost never accumulated. Its "distance" collapsed to the gap between
// the last query note and its nearest neighbour anywhere in the
// reference — nearly always zero. Three unrelated songs all scored
// 1.0000.
//
// The tests below pin the properties a distance function has to have
// for the confidence number above it to mean anything: it must go up
// when the melodies diverge, it must not be fooled by a reference that
// merely contains the right notes in the wrong order, and it must
// refuse to answer rather than answer "1 semitone off" when it cannot
// align at all.

import { describe, expect, it } from 'vitest'
import { distanceToScore, dtwMatch, dtwMatchSubsequence, } from '@/lib/shazam/dtw'

/** Score a query against a reference the way the matcher does. */
const subScore = (q: number[], r: number[]): number =>
  distanceToScore(dtwMatchSubsequence(q, r).normalizedDistance)

/** A rising phrase, the thing a singer actually hums. */
const PHRASE = [60, 62, 64, 65, 67]

describe('dtwMatch (classic)', () => {
  it('scores an exact repeat as a perfect match', () => {
    const { normalizedDistance } = dtwMatch(PHRASE, PHRASE)
    expect(normalizedDistance).toBe(0)
    expect(distanceToScore(normalizedDistance)).toBe(1)
  })

  it('costs more the further the melody drifts', () => {
    const near = dtwMatch(PHRASE, [60, 62, 64, 65, 68]).normalizedDistance
    const far = dtwMatch(PHRASE, [60, 62, 64, 65, 79]).normalizedDistance
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
  })

  it('absorbs a held note without punishing the singer', () => {
    // Same tune, one note sustained across two frames. Warping is the
    // entire point of DTW; this must not read as a different melody.
    const held = dtwMatch(PHRASE, [60, 62, 62, 64, 65, 67]).normalizedDistance
    expect(distanceToScore(held)).toBeGreaterThan(0.9)
  })

  it('refuses to answer rather than guess when no path fits the band', () => {
    // The Sakoe-Chiba band cannot reach the far corner when the lengths
    // are wildly different. Returning "normalized distance 1" there
    // scored an impossible alignment at exp(-1) = 0.37 — a third of a
    // match, for free, on every long reference.
    const long = Array.from({ length: 400 }, (_, i) => 40 + (i % 30))
    const result = dtwMatch(PHRASE, long)
    expect(result.path).toHaveLength(0)
    expect(distanceToScore(result.normalizedDistance)).toBe(0)
  })

  it('scores empty input as no match, not as a near miss', () => {
    expect(distanceToScore(dtwMatch([], PHRASE).normalizedDistance)).toBe(0)
    expect(distanceToScore(dtwMatch(PHRASE, []).normalizedDistance)).toBe(0)
  })
})

describe('dtwMatchSubsequence', () => {
  it('finds the phrase buried inside a longer reference', () => {
    const song = [50, 52, 53, ...PHRASE, 70, 69, 67, 65]
    expect(subScore(PHRASE, song)).toBeGreaterThan(0.95)
  })

  it('reports where in the reference the phrase starts', () => {
    const song = [50, 52, 53, ...PHRASE, 70, 69]
    const { path } = dtwMatchSubsequence(PHRASE, song)
    expect(path.length).toBeGreaterThan(0)
    expect(path[0][1]).toBe(3)
  })

  it('does not score unrelated songs as perfect matches', () => {
    // THE REGRESSION. Each of these shares exactly one note with the
    // query — its last. Under the old free-restart recurrence all three
    // came back at 1.0000, which is what put "P:100 I:100 C:100 R:100"
    // on three different songs in the UI.
    const sharesOnlyTheLastNote = [
      [50, 51, 52, 53, 54, 55, 67],
      [80, 79, 78, 77, 76, 75, 67],
      [60, 60, 60, 60, 60, 60, 67],
    ]
    for (const ref of sharesOnlyTheLastNote) {
      expect(subScore(PHRASE, ref)).toBeLessThan(0.6)
    }
  })

  it('is not fooled by a reference holding the right notes out of order', () => {
    const scrambled = [67, 60, 65, 62, 64, 67, 60, 62]
    const inOrder = [40, 41, ...PHRASE, 42, 43]
    expect(subScore(PHRASE, inOrder)).toBeGreaterThan(
      subScore(PHRASE, scrambled),
    )
  })

  it('separates the real match from the decoys in one reference', () => {
    // A reference containing both the phrase and a near-miss variant:
    // the score has to reflect the best region, and stay well above what
    // a reference with only the variant earns.
    const withReal = [70, 71, ...PHRASE, 72, 73]
    const variantOnly = [70, 71, 60, 63, 66, 68, 71, 72, 73]
    expect(subScore(PHRASE, withReal)).toBeGreaterThan(0.95)
    expect(subScore(PHRASE, variantOnly)).toBeLessThan(0.75)
  })

  it('ranks a longer shared run above a shorter one', () => {
    const threeNotes = [90, 91, 60, 62, 64, 92, 93, 94]
    const fiveNotes = [90, 91, ...PHRASE, 92, 93]
    expect(subScore(PHRASE, fiveNotes)).toBeGreaterThan(
      subScore(PHRASE, threeNotes),
    )
  })

  it('degrades smoothly as the buried phrase is detuned', () => {
    const bury = (p: number[]): number[] => [45, 46, ...p, 47, 48]
    const exact = subScore(PHRASE, bury(PHRASE))
    const off1 = subScore(PHRASE, bury(PHRASE.map((n) => n + 1)))
    const off5 = subScore(PHRASE, bury(PHRASE.map((n) => n + 5)))
    expect(exact).toBeGreaterThan(off1)
    expect(off1).toBeGreaterThan(off5)
  })

  it('scores empty input as no match', () => {
    expect(
      distanceToScore(dtwMatchSubsequence([], PHRASE).normalizedDistance),
    ).toBe(0)
    expect(
      distanceToScore(dtwMatchSubsequence(PHRASE, []).normalizedDistance),
    ).toBe(0)
  })

  it('handles a single-note query without dividing by zero', () => {
    const result = dtwMatchSubsequence([64], [60, 62, 64, 65])
    expect(Number.isFinite(result.normalizedDistance)).toBe(true)
    expect(distanceToScore(result.normalizedDistance)).toBe(1)
  })
})

describe('chroma matching is where saturation hides', () => {
  // Chroma folds every note to one of twelve values, so a long enough
  // reference contains a hit for anything. If the distance function is
  // weak, chroma is the feature that saturates first and quietest.
  const chroma = (notes: number[]): number[] => notes.map((n) => n % 12)

  it('still separates a real chroma match from a coincidental one', () => {
    const query = chroma(PHRASE)
    const real = chroma([50, 51, ...PHRASE, 52])
    const coincidental = chroma([61, 63, 66, 68, 70, 61, 63, 66, 68, 70])
    expect(subScore(query, real)).toBeGreaterThan(subScore(query, coincidental))
    expect(subScore(query, coincidental)).toBeLessThan(0.75)
  })

  it('does not hand every long reference a perfect chroma score', () => {
    const query = chroma(PHRASE)
    // Every pitch class, twice — under the old recurrence this scored 1.0
    // because it contains SOME note matching the query's last.
    const everything = [...Array(24).keys()].map((i) => i % 12)
    expect(subScore(query, everything)).toBeLessThan(0.85)
  })
})

describe('distanceToScore', () => {
  it('maps a perfect alignment to 1 and hopeless ones to 0', () => {
    expect(distanceToScore(0)).toBe(1)
    expect(distanceToScore(10)).toBe(0)
    expect(distanceToScore(Infinity)).toBe(0)
  })

  it('decreases monotonically', () => {
    const scores = [0, 0.5, 1, 2, 4].map(distanceToScore)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1])
    }
  })
})
