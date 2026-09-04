// The shape rule, pinned to the numbers the plan was designed against.
// ============================================================
//
// docs/games/sorting-line.md §2 states this world in one table, and
// every room's geometry is derived from it. If these numbers move, the
// rooms move, so they are held here rather than trusted.

import { describe, expect, it } from 'vitest'
import { FLAT_HEIGHT, FLAT_READS_ABOVE_HEIGHT, MIN_WORKING_SEMIS, RANGE_TRIM_SEMIS, REST_HEIGHT, REST_WIDTH, restTFor, silhouetteFor, SWEEP, TALL_HEIGHT, tFor, VOLUME, workingRange, } from './tension3d'

describe('the silhouette', () => {
  // The two ends and the body they make. §2's original table started at
  // 0.16; the flat end was raised after 4a (§14), so this is the table
  // as shipped.
  it.each([
    [0.0, 0.32, 0.47],
    [1.0, 0.94, 0.28],
  ])('t = %s is %s tall and %s wide', (t, height, width) => {
    const s = silhouetteFor(t)
    expect(s.height).toBeCloseTo(height, 2)
    expect(s.width).toBeCloseTo(width, 2)
  })

  // The claim that makes rest a shape rather than a null state: the
  // Merc who already ships lies on the sweep, at `restTFor`.
  it('puts the shipped Merc on the curve', () => {
    expect(REST_HEIGHT).toBe(0.55)
    const rest = silhouetteFor(restTFor())
    expect(rest.height).toBeCloseTo(REST_HEIGHT, 12)
    expect(rest.width).toBeCloseTo(REST_WIDTH, 6)
    expect(restTFor()).toBeCloseTo(0.371, 3)
  })

  it('takes a different sweep and keeps the volume', () => {
    const wide = { flat: 0.2, tall: 1.2 }
    expect(silhouetteFor(0, wide).height).toBe(0.2)
    expect(silhouetteFor(1, wide).height).toBe(1.2)
    const s = silhouetteFor(0.4, wide)
    expect(s.width * s.width * s.height).toBeCloseTo(VOLUME, 12)
    expect(restTFor(wide)).toBeCloseTo(0.35, 12)
  })

  it('is linear in height and monotonic in both', () => {
    const steps = Array.from({ length: 21 }, (_, i) => silhouetteFor(i / 20))
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]!.height).toBeGreaterThan(steps[i - 1]!.height)
      expect(steps[i]!.width).toBeLessThan(steps[i - 1]!.width)
    }
    expect(steps[0]!.height).toBe(FLAT_HEIGHT)
    expect(steps[20]!.height).toBe(TALL_HEIGHT)
  })

  // The whole mechanic. Clearance and support move in opposite
  // directions ONLY because this holds; if it drifts, flat stops being
  // a real trade against tall and the world becomes one dial.
  it('conserves w squared times h across the whole sweep', () => {
    for (let i = 0; i <= 40; i += 1) {
      const s = silhouetteFor(i / 40)
      expect(s.width * s.width * s.height).toBeCloseTo(VOLUME, 12)
    }
  })

  it.each([-3, -0.001, Number.NaN])('clamps %s to the puddle', (t) => {
    expect(silhouetteFor(t).height).toBe(FLAT_HEIGHT)
  })

  it.each([1.001, 40])('clamps %s to the thread', (t) => {
    expect(silhouetteFor(t).height).toBe(TALL_HEIGHT)
  })

  // A puddle is half again as wide as it is tall and a thread 3.4x
  // taller than it is wide. Stated as ratios because that is what a
  // phone shows -- if either end stops reading as a body, this is the
  // number that moved.
  it('reaches a real puddle and a real thread', () => {
    const flat = silhouetteFor(0)
    const tall = silhouetteFor(1)
    expect(flat.width / flat.height).toBeGreaterThan(1.4)
    expect(tall.height / tall.width).toBeGreaterThan(3)
  })
})

describe('what step 4a measured', () => {
  // maff chose to dial rather than fix the face in art, so the finding
  // is now load-bearing: the flat end may not go under the line the
  // face was seen to survive.
  it('keeps the flat end where the face still reads', () => {
    expect(SWEEP.flat).toBeGreaterThanOrEqual(FLAT_READS_ABOVE_HEIGHT)
    expect(FLAT_HEIGHT).toBe(SWEEP.flat)
    expect(TALL_HEIGHT).toBe(SWEEP.tall)
  })

  it('still has the tall end maff called good', () => {
    expect(SWEEP.tall).toBe(0.94)
  })
})

describe('reading a pitch against a voice', () => {
  const range = { lowMidi: 48, highMidi: 72 }

  it('puts the bottom at 0 and the top at 1', () => {
    expect(tFor(48, range)).toBe(0)
    expect(tFor(72, range)).toBe(1)
    expect(tFor(60, range)).toBeCloseTo(0.5, 12)
  })

  it('clamps rather than running off either end', () => {
    expect(tFor(20, range)).toBe(0)
    expect(tFor(120, range)).toBe(1)
  })

  // Two singers with nothing in common vocally sing completely
  // different pitches through the same room and are both right. This is
  // the property that makes the world playable by someone who cannot
  // match pitch, so it is pinned rather than assumed.
  it('gives a bass and a soprano the same t for the same relative note', () => {
    const bass = { lowMidi: 40, highMidi: 64 }
    const soprano = { lowMidi: 60, highMidi: 84 }
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      expect(tFor(40 + 24 * frac, bass)).toBeCloseTo(
        tFor(60 + 24 * frac, soprano),
        12,
      )
    }
  })

  it.each([
    ['no width at all', { lowMidi: 60, highMidi: 60 }],
    ['upside down', { lowMidi: 72, highMidi: 48 }],
  ])('answers rest for a range with %s', (_why, bad) => {
    expect(tFor(60, bad)).toBe(0.5)
  })

  it('answers rest for a pitch that is not a number', () => {
    expect(tFor(Number.NaN, range)).toBe(0.5)
  })
})

describe('trimming the measured range', () => {
  it('pulls in a semitone at each end', () => {
    expect(workingRange({ lowMidi: 48, highMidi: 72 })).toEqual({
      lowMidi: 49,
      highMidi: 71,
    })
  })

  // The trim exists so the ends are reachable; a singer at one semitone
  // in should already be all the way flat.
  it('lets a semitone inside the measurement reach the end', () => {
    const trimmed = workingRange({ lowMidi: 48, highMidi: 72 })
    expect(tFor(49, trimmed)).toBe(0)
    expect(tFor(71, trimmed)).toBe(1)
  })

  // A bad measurement should be used untrimmed rather than turned into
  // a hair trigger -- or, narrower still, inverted.
  it('leaves a range alone when there is not enough of it to trim', () => {
    const narrow = { lowMidi: 60, highMidi: 60 + MIN_WORKING_SEMIS }
    expect(workingRange(narrow)).toEqual(narrow)
  })

  it('never returns a range it has inverted', () => {
    for (let span = 0; span <= 30; span += 1) {
      const out = workingRange({ lowMidi: 60, highMidi: 60 + span })
      expect(out.highMidi).toBeGreaterThanOrEqual(out.lowMidi)
    }
  })

  it('keeps every voice preset wide enough to play', () => {
    // The presets are 24 semitones; trimmed they must still be far more
    // than the narrowest band any gate asks for (§2.1 asks for 3.5).
    const out = workingRange({ lowMidi: 45, highMidi: 69 })
    expect(out.highMidi - out.lowMidi).toBe(24 - 2 * RANGE_TRIM_SEMIS)
  })
})
