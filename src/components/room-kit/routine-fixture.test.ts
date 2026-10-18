// ============================================================
// The dev fixtures' stop of the Warm-up: `&warmUp=<n>`
// ============================================================

import { describe, expect, it } from 'vitest'
import { FIXTURE_STOPS, fixtureStop } from './routine-fixture'

describe('fixtureStop', () => {
  it('is no stop without the parameter', () => {
    expect(fixtureStop('')).toBeUndefined()
    expect(fixtureStop('?lipFixture=intro')).toBeUndefined()
  })

  it('names stop n of four, counted from one', () => {
    const stop = fixtureStop('?lipFixture=intro&warmUp=3')
    expect([stop?.index, stop?.count, stop?.settledNote]).toEqual([
      2,
      FIXTURE_STOPS,
      null,
    ])
  })

  it('takes a number outside the routine as its first stop', () => {
    for (const value of ['0', '5', 'two', '']) {
      expect(fixtureStop(`?warmUp=${value}`)?.index).toBe(0)
    }
  })
})
