// His feet do not move when his shape does.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { MercAnchor } from './merc-anchor'
import { bodyLiftFor, feetAfterLift, feetBelowRoot } from './merc-anchor'

/** The real export, measured 2026-09-04 through Box3.setFromObject:
 * the torso shell's bottom against the whole actor's height, which is
 * what `createMerc` anchors on. */
const MERC: MercAnchor = {
  rawMinY: -0.6999,
  rawHeight: 1.9028,
  restHeight: 0.55,
}
/** The same export by its whole box, mitts and all. */
const WHOLE: MercAnchor = {
  rawMinY: -0.9519,
  rawHeight: 1.9028,
  restHeight: 0.55,
}

describe('the anchor', () => {
  it('measures the shipped torso as 20 cm under his origin', () => {
    expect(feetBelowRoot(MERC)).toBeCloseTo(0.2023, 4)
    // The mitts hang lower; anchoring on them is the mistake this
    // number exists to make visible.
    expect(feetBelowRoot(WHOLE)).toBeCloseTo(0.2751, 4)
  })

  it('does nothing at rest', () => {
    expect(bodyLiftFor(MERC, 1)).toBe(0)
  })

  // The bug, as a number: the first version returned the negative of
  // these, so a thread sank and a puddle floated.
  it('lifts a stretched body and lowers a squashed one', () => {
    expect(bodyLiftFor(MERC, 0.94 / 0.55)).toBeCloseTo(+0.14345, 4)
    expect(bodyLiftFor(MERC, 0.32 / 0.55)).toBeCloseTo(-0.08458, 4)
  })

  // The invariant the whole file exists for, checked across the sweep
  // and past both ends of it.
  it('holds his lowest point still across every height', () => {
    const rest = feetAfterLift(MERC, 1)
    for (let scale = 0.1; scale <= 3; scale += 0.05) {
      expect(feetAfterLift(MERC, scale)).toBeCloseTo(rest, 12)
    }
  })

  // A different asset, a different origin: the rule must not depend on
  // the origin being the centre, only on the measurement being honest.
  it('works for an asset whose origin is at its feet', () => {
    const atFeet: MercAnchor = { rawMinY: 0, rawHeight: 2, restHeight: 0.5 }
    // toBeCloseTo, not toBe: `-0 * x` is -0, and Object.is minds.
    expect(feetBelowRoot(atFeet)).toBeCloseTo(0, 12)
    for (const scale of [0.3, 1, 2.5]) {
      expect(bodyLiftFor(atFeet, scale)).toBeCloseTo(0, 12)
      expect(feetAfterLift(atFeet, scale)).toBeCloseTo(0, 12)
    }
  })
})
