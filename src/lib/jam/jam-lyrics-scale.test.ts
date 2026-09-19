// ── Jam lyric scale tests ────────────────────────────────────────────
// The one number behind the lyric column's font size. It reaches the
// stylesheet as a multiplier inside calc(), so a NaN here is a column of
// zero-height text; and it is changed from three directions -- buttons, a
// wheel, two fingers -- that all have to agree on a range and on which
// way is "bigger". The ladder is tested hardest, because its whole reason
// to exist is one property a multiplicative step cannot have: up and back
// down is where you started.

import { describe, expect, it } from 'vitest'
import { clampJamLyricsScale, formatJamLyricsScale, isJamLyricsScale, isJamLyricsScaleDefault, JAM_LYRICS_SCALE_DEFAULT, JAM_LYRICS_SCALE_MAX, JAM_LYRICS_SCALE_MIN, JAM_LYRICS_SCALE_STOPS, lyricsScaleFromPinch, lyricsScaleFromWheel, steppedJamLyricsScale, } from '@/lib/jam/jam-lyrics-scale'

describe('clampJamLyricsScale', () => {
  it('holds the range at both ends', () => {
    expect(clampJamLyricsScale(0.1)).toBe(JAM_LYRICS_SCALE_MIN)
    expect(clampJamLyricsScale(99)).toBe(JAM_LYRICS_SCALE_MAX)
    expect(clampJamLyricsScale(1.37)).toBe(1.37)
  })

  it('treats a non-number as the shipped size, not as the smallest', () => {
    // A degenerate gesture must cost the viewer nothing. Falling to the
    // floor would shrink the words because a pinch divided by zero.
    expect(clampJamLyricsScale(Number.NaN)).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(clampJamLyricsScale(Number.POSITIVE_INFINITY)).toBe(
      JAM_LYRICS_SCALE_DEFAULT,
    )
  })
})

describe('isJamLyricsScale', () => {
  it('accepts a value inside the range, ends included', () => {
    expect(isJamLyricsScale(JAM_LYRICS_SCALE_MIN)).toBe(true)
    expect(isJamLyricsScale(1.37)).toBe(true)
    expect(isJamLyricsScale(JAM_LYRICS_SCALE_MAX)).toBe(true)
  })

  it('rejects everything localStorage can hand back instead', () => {
    for (const bad of [
      '1.5',
      null,
      undefined,
      {},
      [],
      true,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      -1,
      0.79,
      2.01,
    ]) {
      expect(isJamLyricsScale(bad)).toBe(false)
    }
  })
})

describe('the ladder', () => {
  it('runs from the floor to the ceiling through the shipped size', () => {
    expect(JAM_LYRICS_SCALE_STOPS[0]).toBe(JAM_LYRICS_SCALE_MIN)
    expect(JAM_LYRICS_SCALE_STOPS[JAM_LYRICS_SCALE_STOPS.length - 1]).toBe(
      JAM_LYRICS_SCALE_MAX,
    )
    expect(JAM_LYRICS_SCALE_STOPS).toContain(JAM_LYRICS_SCALE_DEFAULT)
    const sorted = [...JAM_LYRICS_SCALE_STOPS].sort((a, b) => a - b)
    expect(JAM_LYRICS_SCALE_STOPS).toEqual(sorted)
  })

  it('steps to the neighbouring stop in either direction', () => {
    expect(steppedJamLyricsScale(1, 1)).toBe(1.1)
    expect(steppedJamLyricsScale(1, -1)).toBe(0.9)
    expect(steppedJamLyricsScale(1.25, 1)).toBe(1.5)
    expect(steppedJamLyricsScale(1.25, -1)).toBe(1.1)
  })

  it('comes back to exactly where it started, from either end', () => {
    // The property a multiplicative notch does not have: x1.25 up to a
    // clamped ceiling and /1.25 back down lands on 1.024, not on 1.
    let scale = JAM_LYRICS_SCALE_DEFAULT
    let ups = 0
    while (scale < JAM_LYRICS_SCALE_MAX && ups < 50) {
      scale = steppedJamLyricsScale(scale, 1)
      ups++
    }
    expect(scale).toBe(JAM_LYRICS_SCALE_MAX)
    for (let i = 0; i < ups; i++) scale = steppedJamLyricsScale(scale, -1)
    expect(scale).toBe(JAM_LYRICS_SCALE_DEFAULT)

    let downs = 0
    while (scale > JAM_LYRICS_SCALE_MIN && downs < 50) {
      scale = steppedJamLyricsScale(scale, -1)
      downs++
    }
    for (let i = 0; i < downs; i++) scale = steppedJamLyricsScale(scale, 1)
    expect(scale).toBe(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('crosses the whole range in a countable number of presses', () => {
    let scale = JAM_LYRICS_SCALE_MIN
    let presses = 0
    while (scale < JAM_LYRICS_SCALE_MAX && presses < 50) {
      scale = steppedJamLyricsScale(scale, 1)
      presses++
    }
    expect(scale).toBe(JAM_LYRICS_SCALE_MAX)
    expect(presses).toBe(JAM_LYRICS_SCALE_STOPS.length - 1)
  })

  it('stops at the ends instead of running past them', () => {
    expect(steppedJamLyricsScale(JAM_LYRICS_SCALE_MAX, 1)).toBe(
      JAM_LYRICS_SCALE_MAX,
    )
    expect(steppedJamLyricsScale(JAM_LYRICS_SCALE_MIN, -1)).toBe(
      JAM_LYRICS_SCALE_MIN,
    )
  })

  it('takes a size a pinch left between two stops to the NEXT one', () => {
    // 1.37 sits between 1.25 and 1.5. Larger is 1.5 and smaller is 1.25;
    // jumping a stop in either direction would make the first press after
    // a pinch feel twice as big as every other.
    expect(steppedJamLyricsScale(1.37, 1)).toBe(1.5)
    expect(steppedJamLyricsScale(1.37, -1)).toBe(1.25)
  })

  it('does not count a stop, give or take a float, as below itself', () => {
    // Otherwise the first press from 1.1000000000000001 "steps" to 1.1,
    // and the button looks dead once.
    expect(steppedJamLyricsScale(1.1 + 1e-12, 1)).toBe(1.25)
    expect(steppedJamLyricsScale(1.1 - 1e-12, 1)).toBe(1.25)
    expect(steppedJamLyricsScale(1.1 + 1e-12, -1)).toBe(1)
    expect(steppedJamLyricsScale(1.1 - 1e-12, -1)).toBe(1)
  })
})

describe('lyricsScaleFromWheel', () => {
  it('grows on a wheel towards the viewer and shrinks on a wheel away', () => {
    expect(lyricsScaleFromWheel(1, -100)).toBeGreaterThan(1)
    expect(lyricsScaleFromWheel(1, 100)).toBeLessThan(1)
  })

  it('changes the size by about a tenth for one mouse detent', () => {
    expect(lyricsScaleFromWheel(1, -100)).toBeCloseTo(Math.exp(0.1), 10)
    expect(lyricsScaleFromWheel(1, 100)).toBeCloseTo(Math.exp(-0.1), 10)
  })

  it('undoes a notch with the opposite notch', () => {
    const up = lyricsScaleFromWheel(1.3, -100)
    expect(lyricsScaleFromWheel(up, 100)).toBeCloseTo(1.3, 10)
  })

  it('follows a trackpad in small steps rather than a stop an event', () => {
    // A pinch on a trackpad is sixty of these a second. One stop each
    // would cross the whole ladder in an eighth of a second.
    const nudged = lyricsScaleFromWheel(1, -4)
    expect(nudged).toBeGreaterThan(1)
    expect(nudged).toBeLessThan(1.01)
  })

  it('caps one report at one notch, however far the wheel claims to go', () => {
    expect(lyricsScaleFromWheel(1, -5000)).toBeCloseTo(
      lyricsScaleFromWheel(1, -100),
      10,
    )
  })

  it('reads a wheel reported in lines as a wheel, not as three pixels', () => {
    // Firefox, with a mouse: deltaMode 1 and a delta of 3.
    expect(lyricsScaleFromWheel(1, -3, 1)).toBeCloseTo(
      lyricsScaleFromWheel(1, -100),
      10,
    )
    expect(lyricsScaleFromWheel(1, 1, 2)).toBeCloseTo(
      lyricsScaleFromWheel(1, 100),
      10,
    )
  })

  it('ignores a delta with no vertical component', () => {
    expect(lyricsScaleFromWheel(1.3, 0)).toBe(1.3)
    expect(lyricsScaleFromWheel(1.3, Number.NaN)).toBe(1.3)
  })

  it('still respects the range', () => {
    expect(lyricsScaleFromWheel(JAM_LYRICS_SCALE_MAX, -100)).toBe(
      JAM_LYRICS_SCALE_MAX,
    )
    expect(lyricsScaleFromWheel(JAM_LYRICS_SCALE_MIN, 100)).toBe(
      JAM_LYRICS_SCALE_MIN,
    )
  })
})

describe('lyricsScaleFromPinch', () => {
  it('grows with the spread and shrinks with the pinch', () => {
    expect(lyricsScaleFromPinch(1, 100, 150)).toBeGreaterThan(1)
    expect(lyricsScaleFromPinch(1.5, 150, 100)).toBeLessThan(1.5)
  })

  it('moves the words less than the fingers, so a small change is holdable', () => {
    const grown = lyricsScaleFromPinch(1, 100, 120)
    expect(grown).toBeGreaterThan(1.1)
    expect(grown).toBeLessThan(1.2)
  })

  it('is as strong inwards as outwards', () => {
    // Linear damping is not: it can double a size in one spread and
    // never halve it again, however far the fingers close.
    const out = lyricsScaleFromPinch(1, 100, 200)
    expect(lyricsScaleFromPinch(out, 200, 100)).toBeCloseTo(1, 10)
  })

  it('comes back to where it began when the fingers do', () => {
    expect(lyricsScaleFromPinch(1.37, 180, 180)).toBeCloseTo(1.37, 10)
  })

  it('reaches the ceiling from the shipped size in one comfortable spread', () => {
    expect(lyricsScaleFromPinch(1, 80, 260)).toBe(JAM_LYRICS_SCALE_MAX)
  })

  it('refuses to divide by a degenerate gesture', () => {
    expect(lyricsScaleFromPinch(1.5, 0, 120)).toBe(1.5)
    expect(lyricsScaleFromPinch(1.5, 120, 0)).toBe(1.5)
    expect(lyricsScaleFromPinch(1.5, Number.NaN, 120)).toBe(1.5)
  })

  it('still respects the range', () => {
    expect(lyricsScaleFromPinch(1, 10, 5000)).toBe(JAM_LYRICS_SCALE_MAX)
    expect(lyricsScaleFromPinch(1, 5000, 10)).toBe(JAM_LYRICS_SCALE_MIN)
  })
})

describe('formatJamLyricsScale', () => {
  it('reads as a whole percentage', () => {
    expect(formatJamLyricsScale(1)).toBe('100%')
    expect(formatJamLyricsScale(1.25)).toBe('125%')
    expect(formatJamLyricsScale(0.8)).toBe('80%')
    expect(formatJamLyricsScale(1.3749)).toBe('137%')
  })

  it('never shows a size the words cannot be at', () => {
    expect(formatJamLyricsScale(99)).toBe('200%')
    expect(formatJamLyricsScale(0)).toBe('80%')
    expect(formatJamLyricsScale(Number.NaN)).toBe('100%')
  })
})

describe('isJamLyricsScaleDefault', () => {
  it('is true at the shipped size and nowhere else on the ladder', () => {
    for (const stop of JAM_LYRICS_SCALE_STOPS) {
      expect(isJamLyricsScaleDefault(stop)).toBe(
        stop === JAM_LYRICS_SCALE_DEFAULT,
      )
    }
  })

  it('forgives a float, because the readout would say 100% anyway', () => {
    expect(isJamLyricsScaleDefault(1.0000000001)).toBe(true)
    expect(isJamLyricsScaleDefault(1.02)).toBe(false)
  })
})
