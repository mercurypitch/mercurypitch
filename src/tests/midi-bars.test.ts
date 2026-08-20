import { describe, expect, it } from 'vitest'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { barIndexAtBeat, buildBars, DEFAULT_TIME_SIGNATURE, MAX_BARS, normalizeTimeSignatures, quarterBeatsPerBar, } from '@/lib/midi-bars'

const sig = (
  beat: number,
  numerator: number,
  denominator: number,
): MidiTimeSignature => ({ beat, numerator, denominator })

describe('quarterBeatsPerBar', () => {
  it('counts a common-time bar as four quarters', () => {
    expect(quarterBeatsPerBar(sig(0, 4, 4))).toBe(4)
  })

  it('counts a 6/8 bar as three quarters, not six', () => {
    expect(quarterBeatsPerBar(sig(0, 6, 8))).toBe(3)
  })

  it('counts a 7/8 bar as three and a half quarters', () => {
    expect(quarterBeatsPerBar(sig(0, 7, 8))).toBe(3.5)
  })

  it('counts a cut-time bar as two quarters', () => {
    expect(quarterBeatsPerBar(sig(0, 2, 2))).toBe(4)
  })

  it('falls back to common time when a term is not a number', () => {
    expect(quarterBeatsPerBar(sig(0, Number.NaN, 4))).toBe(4)
    expect(quarterBeatsPerBar(sig(0, 4, Number.POSITIVE_INFINITY))).toBe(4)
  })

  it('falls back to common time when a term is zero or negative', () => {
    expect(quarterBeatsPerBar(sig(0, 0, 4))).toBe(4)
    expect(quarterBeatsPerBar(sig(0, 4, -8))).toBe(4)
  })
})

describe('normalizeTimeSignatures', () => {
  it('gives common time when the file said nothing', () => {
    expect(normalizeTimeSignatures(undefined)).toEqual([DEFAULT_TIME_SIGNATURE])
    expect(normalizeTimeSignatures([])).toEqual([DEFAULT_TIME_SIGNATURE])
  })

  it('assumes common time before a signature written part-way through', () => {
    expect(normalizeTimeSignatures([sig(8, 3, 4)])).toEqual([
      DEFAULT_TIME_SIGNATURE,
      sig(8, 3, 4),
    ])
  })

  it('puts signatures in force order however the file listed them', () => {
    expect(normalizeTimeSignatures([sig(12, 5, 4), sig(0, 3, 4)])).toEqual([
      sig(0, 3, 4),
      sig(12, 5, 4),
    ])
  })

  it('lets the later of two signatures on one beat win', () => {
    expect(normalizeTimeSignatures([sig(0, 3, 4), sig(0, 7, 8)])).toEqual([
      sig(0, 7, 8),
    ])
  })

  it('drops a repeat of the signature already in force', () => {
    // Guitar Pro writes a signature on every master bar, changed or not.
    expect(
      normalizeTimeSignatures([sig(0, 4, 4), sig(4, 4, 4), sig(8, 3, 4)]),
    ).toEqual([sig(0, 4, 4), sig(8, 3, 4)])
  })

  it('drops signatures placed nowhere real', () => {
    expect(
      normalizeTimeSignatures([sig(Number.NaN, 3, 4), sig(-4, 5, 4)]),
    ).toEqual([DEFAULT_TIME_SIGNATURE])
  })

  it('drops a signature no bar could be written in', () => {
    expect(normalizeTimeSignatures([sig(0, 0, 4), sig(4, 3, 4)])).toEqual([
      DEFAULT_TIME_SIGNATURE,
      sig(4, 3, 4),
    ])
  })
})

describe('buildBars', () => {
  it('gives one empty-song bar in the signature that opens it', () => {
    expect(buildBars(0, [sig(0, 3, 4)])).toEqual([
      { index: 0, startBeat: 0, beats: 3 },
    ])
  })

  it('treats a span that is not a number as an empty song', () => {
    expect(buildBars(Number.NaN, undefined)).toEqual([
      { index: 0, startBeat: 0, beats: 4 },
    ])
  })

  it('treats a negative span as an empty song', () => {
    expect(buildBars(-8, undefined)).toEqual([
      { index: 0, startBeat: 0, beats: 4 },
    ])
  })

  it('lays common time out in fours', () => {
    expect(buildBars(12, undefined)).toEqual([
      { index: 0, startBeat: 0, beats: 4 },
      { index: 1, startBeat: 4, beats: 4 },
      { index: 2, startBeat: 8, beats: 4 },
    ])
  })

  it('cuts the last bar to the music that is actually in it', () => {
    expect(buildBars(10, undefined).at(-1)).toEqual({
      index: 2,
      startBeat: 8,
      beats: 2,
    })
  })

  it('changes bar length from the beat the signature takes effect', () => {
    expect(buildBars(14, [sig(0, 4, 4), sig(8, 3, 4)])).toEqual([
      { index: 0, startBeat: 0, beats: 4 },
      { index: 1, startBeat: 4, beats: 4 },
      { index: 2, startBeat: 8, beats: 3 },
      { index: 3, startBeat: 11, beats: 3 },
    ])
  })

  it('cuts a bar short when the signature changes inside it', () => {
    // A pickup: the 2/4 lands two beats into what would have been a 4/4 bar.
    expect(buildBars(8, [sig(0, 4, 4), sig(2, 2, 4)])).toEqual([
      { index: 0, startBeat: 0, beats: 2 },
      { index: 1, startBeat: 2, beats: 2 },
      { index: 2, startBeat: 4, beats: 2 },
      { index: 3, startBeat: 6, beats: 2 },
    ])
  })

  it('counts a 6/8 bar as three quarters of music', () => {
    expect(buildBars(6, [sig(0, 6, 8)])).toEqual([
      { index: 0, startBeat: 0, beats: 3 },
      { index: 1, startBeat: 3, beats: 3 },
    ])
  })

  it('stops rather than laying out a corrupt file forever', () => {
    const bars = buildBars(MAX_BARS * 8, [sig(0, 1, 4)])
    expect(bars).toHaveLength(MAX_BARS)
  })
})

describe('barIndexAtBeat', () => {
  const bars = buildBars(14, [sig(0, 4, 4), sig(8, 3, 4)])

  it('reads beat zero as the first bar', () => {
    expect(barIndexAtBeat(bars, 0)).toBe(0)
  })

  it('reads a beat inside a bar as that bar', () => {
    expect(barIndexAtBeat(bars, 5.5)).toBe(1)
    expect(barIndexAtBeat(bars, 12)).toBe(3)
  })

  it('reads a bar line as the bar it opens', () => {
    expect(barIndexAtBeat(bars, 8)).toBe(2)
  })

  it('holds at the last bar past the end of the song', () => {
    expect(barIndexAtBeat(bars, 999)).toBe(3)
  })

  it('holds at the first bar before the start of the song', () => {
    expect(barIndexAtBeat(bars, -4)).toBe(0)
    expect(barIndexAtBeat(bars, Number.NaN)).toBe(0)
  })

  it('answers zero when there are no bars at all', () => {
    expect(barIndexAtBeat([], 4)).toBe(0)
  })
})
