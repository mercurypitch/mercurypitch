// The spring, the relax, and the bands -- pinned to the plan's claims.
// ============================================================

import { describe, expect, it } from 'vitest'
import { VOICE_PRESETS } from '../voice-range'
import { bandCentre, bandFor, fitsSlotHeight, fitsSlotWidth, GAP_RELAX_SECONDS, gapWidthFor, inBand, LETTERBOX, MIN_CONFIDENCE, RELAX_SECONDS, relaxToward, REST_MARGIN, restTFor, silhouetteFor, slotHeightFor, slotWidthFor, SPRING_OMEGA, springAt, springStep, supportedBy, tensionStep, tForHeight, tForTorso, TORSO_OF_HEIGHT, torsoHeight, widenRange, workingRange, } from './tension3d'

const DT = 1 / 120
const run = (
  from: number,
  target: number,
  seconds: number,
): { t: number; peak: number } => {
  let s = springAt(from)
  let peak = from
  for (let time = 0; time < seconds; time += DT) {
    s = springStep(s, target, DT)
    peak = Math.max(peak, s.t)
  }
  return { t: s.t, peak }
}

describe('the spring', () => {
  it('settles in about half a second', () => {
    expect(SPRING_OMEGA).toBe(9)
    expect(Math.abs(run(0, 1, 0.45).t - 1)).toBeLessThan(0.1)
    expect(Math.abs(run(0, 1, 0.6).t - 1)).toBeLessThan(0.04)
    expect(Math.abs(run(0, 1, 1.0).t - 1)).toBeLessThan(0.002)
  })

  // Critically damped means no overshoot, and no overshoot is what keeps
  // a fast siren from reading as Merc bouncing.
  it('never overshoots', () => {
    expect(run(0, 0.8, 2).peak).toBeLessThanOrEqual(0.8 + 1e-9)
  })

  it('ignores a non-positive dt', () => {
    const s = springAt(0.3)
    expect(springStep(s, 1, 0)).toBe(s)
    expect(springStep(s, 1, -1)).toBe(s)
  })
})

describe('the relax', () => {
  it('is an exact exponential, so the step size does not matter', () => {
    let fine = 0.2
    for (let i = 0; i < 120; i += 1) fine = relaxToward(fine, 0.5, 1 / 120, 6)
    const coarse = relaxToward(0.2, 0.5, 1, 6)
    expect(fine).toBeCloseTo(coarse, 9)
  })

  it('goes most of the way in one time constant', () => {
    expect(relaxToward(0, 1, RELAX_SECONDS, RELAX_SECONDS)).toBeCloseTo(
      1 - Math.exp(-1),
      9,
    )
  })
})

describe('one frame of the whole rule', () => {
  const range = { lowMidi: 48, highMidi: 72 }

  it('pulls toward the sung pitch when the detector is sure', () => {
    const s = tensionStep(
      springAt(0.5),
      { midi: 72, confidence: 0.9 },
      range,
      0.2,
    )
    expect(s.t).toBeGreaterThan(0.5)
  })

  it('relaxes toward rest in silence, at full rate', () => {
    const s = tensionStep(
      springAt(0.9),
      { midi: null, confidence: 0 },
      range,
      1,
    )
    expect(s.t).toBeCloseTo(relaxToward(0.9, restTFor(), 1, RELAX_SECONDS), 9)
    expect(s.v).toBe(0)
  })

  // The Blackout's graft: a dropout is not a decision.
  it('relaxes at half rate on a doubtful frame', () => {
    const doubtful = tensionStep(
      springAt(0.9),
      { midi: 60, confidence: MIN_CONFIDENCE - 0.01 },
      range,
      1,
    )
    expect(doubtful.t).toBeCloseTo(
      relaxToward(0.9, restTFor(), 1, GAP_RELAX_SECONDS),
      9,
    )
    expect(GAP_RELAX_SECONDS).toBe(2 * RELAX_SECONDS)
  })

  // Room 2's clock (§5): from the flat end, silence must cross the mesh
  // in one breath with slack; from the island, it must reach the slot.
  it('leaves room 2 crossable in one breath, from both ends', () => {
    const walk = 1.15
    const support = bandFor({ end: 'flat', tLimit: 0.313, semis: 5 }, range)
    let t = 0.2
    let seconds = 0
    while (inBand(t, support)) {
      t = relaxToward(t, restTFor(), DT, RELAX_SECONDS)
      seconds += DT
    }
    expect(seconds * walk).toBeGreaterThan(2.0 + 1.0)

    const slot = bandFor({ end: 'tall', tLimit: 0.634, semis: 5 }, range)
    t = 0.75
    seconds = 0
    while (inBand(t, slot)) {
      t = relaxToward(t, restTFor(), DT, RELAX_SECONDS)
      seconds += DT
    }
    expect(seconds * walk).toBeGreaterThan(1.3 + 0.5)
  })
})

describe('the bands', () => {
  it('takes the more generous of the two asks', () => {
    const wide = bandFor(LETTERBOX, { lowMidi: 40, highMidi: 57 }) // 17
    const narrow = bandFor(LETTERBOX, { lowMidi: 40, highMidi: 50 }) // 10
    expect(wide.hi).toBeCloseTo(4 / 17, 6)
    expect(narrow.hi).toBeGreaterThan(wide.hi)
  })

  // The rule that keeps a gate a gate: the resting drop never fits.
  it('never admits the resting drop, flat or tall', () => {
    for (const span of [8, 10, 12, 17, 24, 30]) {
      const range = { lowMidi: 40, highMidi: 40 + span }
      for (const gate of [
        LETTERBOX,
        { end: 'flat', tLimit: 0.9, semis: 40 },
        { end: 'tall', tLimit: 0.9, semis: 40 },
        { end: 'tall', tLimit: 0.634, semis: 5 },
      ] as const) {
        const b = bandFor(gate, range)
        expect(inBand(restTFor(), b), `${gate.end} at ${span}`).toBe(false)
        const margin =
          gate.end === 'flat' ? restTFor() - b.hi : b.lo - restTFor()
        expect(margin).toBeGreaterThanOrEqual(REST_MARGIN - 1e-9)
      }
    }
  })

  // §2.1's promise, for every voice preset once trimmed: every gate
  // admits at least 3.5 semitones of band.
  it('gives every preset at least three and a half semitones', () => {
    for (const preset of VOICE_PRESETS) {
      const range = workingRange(preset)
      const span = range.highMidi - range.lowMidi
      for (const gate of [
        LETTERBOX,
        { end: 'flat', tLimit: 0.313, semis: 5 },
        { end: 'tall', tLimit: 0.634, semis: 5 },
      ] as const) {
        const b = bandFor(gate, range)
        expect(
          (b.hi - b.lo) * span,
          `${preset.id} ${gate.end}`,
        ).toBeGreaterThanOrEqual(3.5)
      }
    }
  })

  it('stands the ghost in the middle of the band', () => {
    expect(bandCentre({ lo: 0.1, hi: 0.3 })).toBeCloseTo(0.2, 12)
  })
})

describe('the furniture, drawn by the function that judges it', () => {
  const range = { lowMidi: 48, highMidi: 72 }
  const letterbox = bandFor(LETTERBOX, range)

  // The measurement the torso ratio comes from, so an asset re-export
  // that changes it fails here rather than as a slot that lies.
  it('sizes the torso as the measured shell', () => {
    expect(TORSO_OF_HEIGHT).toBeCloseTo(0.8676, 4)
    expect(torsoHeight(silhouetteFor(restTFor()))).toBeCloseTo(0.477, 3)
  })

  it('runs the sweep backwards, and clamps what it cannot reach', () => {
    for (const t of [0, 0.23, restTFor(), 0.634, 1]) {
      expect(tForHeight(silhouetteFor(t).height)).toBeCloseTo(t, 9)
      expect(tForTorso(torsoHeight(silhouetteFor(t)))).toBeCloseTo(t, 9)
    }
    expect(tForHeight(0.1)).toBe(0)
    expect(tForHeight(5)).toBe(1)
  })

  it('makes a slot exactly as tall as the tallest body it admits', () => {
    const h = slotHeightFor(letterbox)
    expect(fitsSlotHeight(silhouetteFor(letterbox.hi), h)).toBe(true)
    expect(fitsSlotHeight(silhouetteFor(letterbox.hi + 0.01), h)).toBe(false)
    expect(fitsSlotHeight(silhouetteFor(0), h)).toBe(true)
  })

  it('makes a vertical slot exactly as wide as the widest body it admits', () => {
    const slot = bandFor({ end: 'tall', tLimit: 0.634, semis: 5 }, range)
    const w = slotWidthFor(slot)
    expect(fitsSlotWidth(silhouetteFor(slot.lo), w)).toBe(true)
    expect(fitsSlotWidth(silhouetteFor(slot.lo - 0.01), w)).toBe(false)
    expect(fitsSlotWidth(silhouetteFor(1), w)).toBe(true)
  })

  // The trade itself: the body that spans the gap is the body that
  // cannot pass the slot, and vice versa.
  it('makes clearance and support opposites', () => {
    const support = bandFor({ end: 'flat', tLimit: 0.313, semis: 5 }, range)
    const slot = bandFor({ end: 'tall', tLimit: 0.634, semis: 5 }, range)
    const gap = gapWidthFor(support)
    const slotW = slotWidthFor(slot)
    const flat = silhouetteFor(bandCentre(support))
    const tall = silhouetteFor(bandCentre(slot))
    expect(supportedBy(flat, gap)).toBe(true)
    expect(fitsSlotWidth(flat, slotW)).toBe(false)
    expect(supportedBy(tall, gap)).toBe(false)
    expect(fitsSlotWidth(tall, slotW)).toBe(true)
    // And the resting drop does neither, which is why a player has to
    // sing at all.
    const rest = silhouetteFor(restTFor())
    expect(supportedBy(rest, gap)).toBe(false)
    expect(fitsSlotWidth(rest, slotW)).toBe(false)
  })
})

describe('the range, taken from the voice in the room', () => {
  const range = { lowMidi: 50, highMidi: 70 }

  it('widens to a note just outside, either end', () => {
    expect(widenRange(range, 47)).toEqual({ lowMidi: 47, highMidi: 70 })
    expect(widenRange(range, 74)).toEqual({ lowMidi: 50, highMidi: 74 })
  })

  it('leaves a note inside alone', () => {
    expect(widenRange(range, 60)).toBe(range)
  })

  // An octave error is one stable wrong answer; letting it in would
  // double the control surface for good.
  it('ignores a note more than an octave out', () => {
    expect(widenRange(range, 37)).toBe(range)
    expect(widenRange(range, 83)).toBe(range)
    expect(widenRange(range, 38)).toEqual({ lowMidi: 38, highMidi: 70 })
  })
})
