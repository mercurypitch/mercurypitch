// ============================================================
// The large title, scrolled under the small bar
// ============================================================

import { describe, expect, it } from 'vitest'
import { BAR_BAND, collapseProgress } from './title-collapse'

// A 390 x 844 iPhone: the status bar 47, the bar's band under it.
const BAR_BOTTOM = 47 + BAR_BAND
// The title's foot at rest: under the status bar, on the header's row.
const TITLE_AT_REST = 98

describe("the large title's progress under the bar", () => {
  it('is at rest before the tab has scrolled', () => {
    expect(
      collapseProgress({
        scrollTop: 0,
        titleBottom: TITLE_AT_REST,
        barBottom: BAR_BOTTOM,
      }),
    ).toBe(0)
  })

  it('is the share of the way to the status bar the title has come', () => {
    expect(
      collapseProgress({
        scrollTop: 17,
        titleBottom: TITLE_AT_REST - 17,
        barBottom: BAR_BOTTOM,
      }),
    ).toBeCloseTo(17 / (TITLE_AT_REST - 47), 6)
  })

  it('is gone once the title’s foot is above the status bar’s, and stays gone', () => {
    const gone = TITLE_AT_REST - 47
    expect(
      collapseProgress({
        scrollTop: gone,
        titleBottom: 47,
        barBottom: BAR_BOTTOM,
      }),
    ).toBe(1)
    expect(
      collapseProgress({
        scrollTop: 600,
        titleBottom: TITLE_AT_REST - 600,
        barBottom: BAR_BOTTOM,
      }),
    ).toBe(1)
  })

  it('stays at rest where nothing was laid out', () => {
    expect(
      collapseProgress({ scrollTop: 120, titleBottom: 0, barBottom: 0 }),
    ).toBe(0)
  })
})
