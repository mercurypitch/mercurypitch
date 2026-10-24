// ============================================================
// Which pictures the flow fetches ahead
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Beat } from './flow'
import type { Plate } from './plates'
import { plateFor, platesAhead, plateSrc } from './plates'

describe('the pictures fetched ahead', () => {
  // Past the walk a "Not now" leads to the questions (the plain sky) while the
  // plan is due and to the Map once it is answered, so both are fetched, the
  // plain sky first. The questions lead to the Map by "See every room" alone.
  it.each<[Beat, readonly Plate[]]>([
    ['sky', ['first-light']],
    ['first-light', ['plain', 'map']],
    ['fork', ['plain', 'map']],
    ['questions', ['map']],
  ])('fetches the pictures that can follow the %s beat', (beat, plates) => {
    expect(platesAhead(beat)).toEqual(plates)
  })

  it("puts the voiceprint, where the Fork's button leads, on the plain sky", () => {
    expect(plateFor('voiceprint')).toBe('plain')
  })

  it('never fetches the picture the beat is already showing', () => {
    for (const beat of [
      'sky',
      'first-light',
      'fork',
      'prints',
      'voiceprint',
      'twin',
      'keep',
      'questions',
      'map',
    ] as const) {
      expect(platesAhead(beat)).not.toContain(plateFor(beat))
    }
  })

  it("puts the questions on the plain sky: Merc is the plan host's, so no plate paints a second one", () => {
    // The Map's plate has Merc painted into it, and the questions bring
    // their own, live or his still, above the screens.
    expect(plateFor('questions')).toBe('plain')
  })

  it('names a different file for each shape of window', () => {
    expect(plateSrc('plain', false)).toBe('/onboarding/sky-wide.webp')
    expect(plateSrc('plain', true)).toBe('/onboarding/sky-tall.webp')
  })
})
