// ============================================================
// Tests: journey-config — the one portrait rule for the journey's view.
// ============================================================

import { describe, expect, it } from 'vitest'
import { JOURNEY_CONFIG, viewUnitsFor } from './journey-config'

describe('viewUnitsFor', () => {
  it('shows fewer units on a phone held upright', () => {
    expect(viewUnitsFor(390, 844)).toBe(JOURNEY_CONFIG.art.viewUnitsPortrait)
    expect(viewUnitsFor(844, 390)).toBe(JOURNEY_CONFIG.view.viewUnits)
  })

  it('draws the line at four fifths, not at square', () => {
    // The hit-test once switched at square while draw() switched at 0.8,
    // so a near-square viewport was drawn one way and answered another.
    expect(viewUnitsFor(700, 900)).toBe(JOURNEY_CONFIG.art.viewUnitsPortrait)
    expect(viewUnitsFor(800, 900)).toBe(JOURNEY_CONFIG.view.viewUnits)
  })

  it('reads a zero-height canvas as landscape', () => {
    expect(viewUnitsFor(0, 0)).toBe(JOURNEY_CONFIG.view.viewUnits)
  })
})
