// ============================================================
// Which pictures the flow fetches ahead
// ============================================================

import { describe, expect, it } from 'vitest'
import { plateFor, platesAhead, plateSrc } from './plates'

describe('the pictures fetched ahead', () => {
  it('fetches the plain sky behind the Fork, where its one button leads, then the Map behind "Not now"', () => {
    expect(platesAhead('fork')).toEqual(['plain', 'map'])
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
      'map',
    ] as const) {
      expect(platesAhead(beat)).not.toContain(plateFor(beat))
    }
  })

  it('names a different file for each shape of window', () => {
    expect(plateSrc('plain', false)).toBe('/onboarding/sky-wide.webp')
    expect(plateSrc('plain', true)).toBe('/onboarding/sky-tall.webp')
  })
})
