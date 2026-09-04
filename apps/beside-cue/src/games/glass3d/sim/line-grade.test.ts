// Does the grade measure where a glide stops, and nothing else?
// ============================================================

import { describe, expect, it } from 'vitest'
import { emptySlide, gateQuality, medalFor, midiBandFor, NO_STOPS, overshootCents, roomLine, roomPct, slideStep, statsOf, walkLine, withStop, } from './line-grade'

const DT = 1 / 60

/** Feed a voice trace: each entry is [midi | null, seconds]. Returns
 * the stops, in order. */
const feed = (
  trace: readonly (readonly [number | null, number])[],
): number[] => {
  const s = emptySlide()
  const stops: number[] = []
  for (const [midi, seconds] of trace) {
    for (let t = 0; t < seconds; t += DT) {
      const stop = slideStep(s, midi, DT)
      if (stop !== null) stops.push(stop)
    }
  }
  return stops
}

describe('the slide', () => {
  it('stops once when a note is held, not once per frame', () => {
    expect(feed([[60, 1]])).toEqual([60])
  })

  it('does not stop until the note has been still for the hold', () => {
    expect(feed([[60, 0.1]])).toEqual([])
    expect(feed([[60, 0.2]])).toEqual([60])
  })

  // A pitch tracker jitters by a few cents a frame. At 60 Hz that is a
  // "velocity" of a semitone a second; a velocity rule would never see
  // a stop, and this one must.
  it('sees a stop through tracker jitter', () => {
    const s = emptySlide()
    const stops: number[] = []
    for (let i = 0; i < 30; i++) {
      const jitter = (i % 2 === 0 ? 1 : -1) * 0.03
      const stop = slideStep(s, 60 + jitter, DT)
      if (stop !== null) stops.push(stop)
    }
    expect(stops.length).toBe(1)
  })

  it('needs half a semitone of leaving before the next stop counts', () => {
    // Drift of a quarter tone is the same note settling; a step of a
    // whole tone is a slide to a new one.
    expect(
      feed([
        [60, 0.5],
        [60.25, 0.5],
      ]),
    ).toEqual([60])
    expect(
      feed([
        [60, 0.5],
        [62, 0.5],
      ]),
    ).toEqual([60, 62])
  })

  it('does not count a breath in a held note as a second stop', () => {
    expect(
      feed([
        [60, 0.5],
        [null, 0.3],
        [60, 0.5],
      ]),
    ).toEqual([60])
  })

  it('records where a glide stops, not where it passed through', () => {
    const s = emptySlide()
    const stops: number[] = []
    // A glide from 60 down to 55 over half a second, then held.
    for (let t = 0; t < 0.5; t += DT) {
      const stop = slideStep(s, 60 - 10 * t, DT)
      if (stop !== null) stops.push(stop)
    }
    for (let t = 0; t < 0.5; t += DT) {
      const stop = slideStep(s, 55, DT)
      if (stop !== null) stops.push(stop)
    }
    expect(stops).toEqual([55])
  })
})

describe('overshoot', () => {
  const band = { lo: 50, hi: 54 }
  it('is zero inside and the distance to the nearest edge outside', () => {
    expect(overshootCents(52, band)).toBe(0)
    expect(overshootCents(50, band)).toBe(0)
    expect(overshootCents(49.5, band)).toBeCloseTo(50, 9)
    expect(overshootCents(55, band)).toBeCloseTo(100, 9)
  })

  it('turns a band in t into a band in midi', () => {
    const range = { lowMidi: 48, highMidi: 72 }
    expect(midiBandFor({ lo: 0, hi: 0.25 }, range)).toEqual({ lo: 48, hi: 54 })
    expect(midiBandFor({ lo: 0.5, hi: 1 }, range)).toEqual({ lo: 60, hi: 72 })
  })
})

describe('a gate', () => {
  const band = { lo: 50, hi: 54 } // 400 cents wide

  it('is first-try when the first stop lands inside, and stays so', () => {
    let g = withStop(NO_STOPS, 52, band)
    expect(g).toEqual({ stops: 1, firstTry: true, overshootCents: 0 })
    g = withStop(g, 58, band)
    expect(g.firstTry).toBe(true)
    expect(g.overshootCents).toBe(0)
    expect(g.stops).toBe(2)
  })

  it("keeps the first stop's overshoot through the corrections", () => {
    let g = withStop(NO_STOPS, 55, band)
    expect(g.firstTry).toBe(false)
    expect(g.overshootCents).toBeCloseTo(100, 9)
    g = withStop(g, 52, band)
    expect(g.overshootCents).toBeCloseTo(100, 9)
    expect(g.stops).toBe(2)
  })

  // §9: clamp01(1 - overshoot / bandCents), the gate's own band as the
  // zero point. A stop a whole band past the edge is worth nothing.
  it('scores against its own band', () => {
    expect(gateQuality(withStop(NO_STOPS, 52, band), band)).toBe(1)
    expect(gateQuality(withStop(NO_STOPS, 55, band), band)).toBeCloseTo(0.75, 9)
    expect(gateQuality(withStop(NO_STOPS, 58, band), band)).toBe(0)
    expect(gateQuality(NO_STOPS, band)).toBe(1)
  })
})

describe('a room', () => {
  const band = { lo: 50, hi: 54 }
  const bands = [band, band, band]

  it('is the mean gate quality less the drops', () => {
    const gates = [
      withStop(NO_STOPS, 52, band),
      withStop(NO_STOPS, 55, band),
      withStop(NO_STOPS, 52, band),
    ]
    expect(roomPct({ gates, bands, drops: 0 })).toBe(92)
    expect(roomPct({ gates, bands, drops: 1 })).toBe(88)
  })

  it("reads as the plan's card", () => {
    const gates = [
      withStop(NO_STOPS, 52, band),
      withStop(NO_STOPS, 55.86, band),
      withStop(NO_STOPS, 52, band),
    ]
    expect(roomLine(statsOf({ gates, bands, drops: 1 }))).toBe(
      '62¢ past the gate · 2 of 3 first time · dropped once',
    )
    expect(roomLine(statsOf({ gates, bands, drops: 0 }))).toBe(
      '62¢ past the gate · 2 of 3 first time',
    )
    expect(roomLine(statsOf({ gates, bands, drops: 3 }))).toMatch(
      /dropped 3 times$/,
    )
  })

  it("hands out the app's medals at the app's thresholds", () => {
    expect(medalFor(95)).toBe('gold')
    expect(medalFor(90)).toBe('gold')
    expect(medalFor(80)).toBe('silver')
    expect(medalFor(60)).toBe('bronze')
    expect(medalFor(54)).toBeNull()
  })
})

describe('the walk', () => {
  it('averages over every gate, and counts every first try', () => {
    const rooms = [
      { pct: 90, overshootCents: 100, firstTry: 1, gates: 1, drops: 0 },
      { pct: 80, overshootCents: 76, firstTry: 10, gates: 13, drops: 2 },
    ]
    expect(walkLine(rooms)).toBe(
      '78¢ past the gate on average · 11 of 14 gates first time',
    )
    expect(walkLine([])).toBe('')
  })
})
