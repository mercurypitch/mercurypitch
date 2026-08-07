// ============================================================
// The tour progress row has a mark budget
// ============================================================
//
// The row draws one fixed-size mark per step and never wraps. That is the
// fix for a defect that shipped: the marks used to share a line with the
// controls and wrap, so a fifteen-step section rendered as a two- or
// three-row block of specks.
//
// "Never wraps" is arithmetic, not a CSS property -- nothing in the
// stylesheet stops a twenty-step tour from running off the card. So the
// budget lives here, where authoring a longer tour fails a test instead of
// quietly overflowing a phone nobody tested on.
//
// Measured in Chromium against the real stylesheet, at the narrowest
// viewport the app supports (320px):
//
//   card              min(340px, 100vw - 24px) = 296px, border-box
//   padding           12px 14px below 360px       -> 266px of line
//   mark              10px dash + 2px padding either side = 14px
//   count readout     ~28px plus an 8px gap, shown from COUNT_FROM steps
//
//   (266 - 36) / 14 = 16 marks
//
// Today's longest is 15 (the walkthrough's practice section), which
// measured 208px with 58px to spare. If you need a longer tour, split it
// into sections -- the row is section-scoped for the full walkthrough --
// or change the row's shape and re-measure, then move this number.

import { describe, expect, it } from 'vitest'
import { PAGE_TOURS, WALKTHROUGH_STEPS } from '@/stores/app-store'

/** Marks that fit one line on a 320px phone beside the count readout. */
const MARK_BUDGET = 16

describe('tour progress row', () => {
  it('gives every walkthrough section a step count the row can draw', () => {
    const perSection = new Map<string, number>()
    for (const step of WALKTHROUGH_STEPS) {
      const section = step.section ?? '(none)'
      perSection.set(section, (perSection.get(section) ?? 0) + 1)
    }

    // Guard against the map going empty and the assertion passing vacuously.
    expect(perSection.size).toBeGreaterThan(3)

    for (const [section, count] of perSection) {
      expect(
        count,
        `walkthrough section "${section}" has ${count} steps; the progress ` +
          `row draws at most ${MARK_BUDGET} on a 320px phone`,
      ).toBeLessThanOrEqual(MARK_BUDGET)
    }
  })

  it('gives every page tour a step count the row can draw', () => {
    const tours = Object.entries(PAGE_TOURS)
    expect(tours.length).toBeGreaterThan(5)

    for (const [tab, steps] of tours) {
      const count = steps?.length ?? 0
      expect(count, `page tour "${tab}" is empty`).toBeGreaterThan(0)
      expect(
        count,
        `page tour "${tab}" has ${count} steps; the progress row draws at ` +
          `most ${MARK_BUDGET} on a 320px phone`,
      ).toBeLessThanOrEqual(MARK_BUDGET)
    }
  })
})
