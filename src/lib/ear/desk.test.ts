import { describe, expect, it } from 'vitest'
import { bandBoost, CRITIQUE_BANK, DESK_BANDS, DESK_DRILLS, DESK_FAULTS, faultOf, lowShelf, pickBand, } from './desk'
import { findThresholdDrill } from './drills'

describe('the desk', () => {
  it('has six octave bands and picks one by the draw', () => {
    expect(DESK_BANDS.map((band) => band.hz)).toEqual([
      125, 250, 500, 1000, 2000, 4000,
    ])
    expect(pickBand(() => 0).id).toBe('b125')
    expect(pickBand(() => 0.999).id).toBe('b4k')
    expect(bandBoost(DESK_BANDS[2], 6)).toEqual({
      kind: 'peak',
      hz: 500,
      q: 1.1,
      db: 6,
    })
    expect(lowShelf(3)).toEqual({ kind: 'shelf', hz: 120, db: 3 })
  })

  it('names six faults with a bank item each', () => {
    expect(DESK_FAULTS.map((fault) => fault.id)).toEqual([
      'mud',
      'box',
      'harsh',
      'sibilance',
      'pumping',
      'narrow',
    ])
    expect(CRITIQUE_BANK).toHaveLength(6)
    expect(faultOf('critique:pumping')?.spec).toEqual({ kind: 'pump' })
    expect(faultOf('critique:nothing')).toBeUndefined()
  })

  it('runs Colour on the catalogue settings under the desk id, Weight and Critique on its own', () => {
    const colour = findThresholdDrill('colour')
    expect(DESK_DRILLS.colour.id).toBe('desk-colour')
    expect(DESK_DRILLS.colour.staircase).toEqual(colour?.staircase)
    expect(DESK_DRILLS.weight).toMatchObject({
      id: 'desk-weight',
      unitShort: 'dB',
    })
    expect(DESK_DRILLS.weight.staircase.start).toBe(6)
    expect(DESK_DRILLS.critique).toMatchObject({
      id: 'desk-critique',
      choices: 6,
      faculty: 'colour',
    })
  })
})
