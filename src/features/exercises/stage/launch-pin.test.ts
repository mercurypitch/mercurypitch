// ============================================================
// The pinned launch button: pinned only with something beyond it
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LaunchPinMeasure } from './launch-pin'
import { launchPin } from './launch-pin'

/** A sheet from 200 to 700 px with a 56 px button in it. */
const sheet = (over: Partial<LaunchPinMeasure>): LaunchPinMeasure => ({
  sheetTop: 200,
  sheetBottom: 700,
  buttonTop: 400,
  buttonBottom: 456,
  scrolled: 0,
  remaining: 0,
  ...over,
})

describe('where the launch button is pinned', () => {
  it('is nowhere at rest, in a sheet that holds all it has', () => {
    expect(launchPin(sheet({}))).toBeNull()
    // At the foot of a short sheet with nothing below is still at rest.
    expect(launchPin(sheet({ buttonTop: 634, buttonBottom: 690 }))).toBeNull()
  })

  it('is the foot while it stands there and more lies below', () => {
    expect(
      launchPin(sheet({ buttonTop: 634, buttonBottom: 690, remaining: 168 })),
    ).toBe('bottom')
  })

  it('is at rest again once the sheet has scrolled it back into its place', () => {
    expect(
      launchPin(
        sheet({
          buttonTop: 520,
          buttonBottom: 576,
          scrolled: 90,
          remaining: 78,
        }),
      ),
    ).toBeNull()
  })

  it('is the top while it stands there and some has scrolled past', () => {
    expect(
      launchPin(
        sheet({
          buttonTop: 210,
          buttonBottom: 266,
          scrolled: 240,
          remaining: 0,
        }),
      ),
    ).toBe('top')
    // Standing at the top of a sheet that has not scrolled is at rest.
    expect(launchPin(sheet({ buttonTop: 210, buttonBottom: 266 }))).toBeNull()
  })

  it('takes a sub-pixel of slack at either edge, and no more than that', () => {
    expect(
      launchPin(
        sheet({ buttonTop: 633.4, buttonBottom: 689.4, remaining: 40 }),
      ),
    ).toBe('bottom')
    expect(
      launchPin(sheet({ buttonTop: 630, buttonBottom: 686, remaining: 40 })),
    ).toBeNull()
  })
})
