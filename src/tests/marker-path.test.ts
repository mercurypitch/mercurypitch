import { describe, expect, it } from 'vitest'
import { buildForwardMarkerPath } from '@/lib/marker-path'

describe('buildForwardMarkerPath', () => {
  it('gives every crossed word a positive interval during a fast drag', () => {
    const samples = buildForwardMarkerPath(
      { lineIdx: 2, wordIdx: 0, progress: 0.4 },
      { lineIdx: 2, wordIdx: 4, progress: 0.25 },
      10,
      11,
    )

    expect(samples.map((sample) => sample.target.wordIdx)).toEqual([
      0, 1, 2, 3, 4,
    ])
    expect(samples.map((sample) => sample.elapsed)).toEqual([
      10, 10.25, 10.5, 10.75, 11,
    ])
    expect(samples[1].target.progress).toBe(1)
    expect(samples[4].target.progress).toBe(0.25)
    for (let index = 1; index < samples.length; index++) {
      expect(samples[index].elapsed).toBeGreaterThan(samples[index - 1].elapsed)
    }
  })

  it('uses millisecond boundaries when pointer events share a clock frame', () => {
    const samples = buildForwardMarkerPath(
      { lineIdx: 0, wordIdx: 0, progress: 0.5 },
      { lineIdx: 0, wordIdx: 3, progress: 0.2 },
      5,
      5,
    )

    expect(samples.at(-1)?.elapsed).toBeCloseTo(5.003)
    for (let index = 1; index < samples.length; index++) {
      expect(samples[index].elapsed).toBeGreaterThan(samples[index - 1].elapsed)
    }
  })

  it('does not synthesize intermediate words for backward movement', () => {
    expect(
      buildForwardMarkerPath(
        { lineIdx: 0, wordIdx: 3, progress: 0.5 },
        { lineIdx: 0, wordIdx: 2, progress: 0.5 },
        4,
        5,
      ),
    ).toEqual([
      {
        target: { lineIdx: 0, wordIdx: 2, progress: 0.5 },
        elapsed: 5,
      },
    ])
  })
})
