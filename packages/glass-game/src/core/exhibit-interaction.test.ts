// Exhibit interaction geometry regressions — manual reach stays broad while automatic singing follows visible contact.

import { describe, expect, it } from 'vitest'
import { AUTOMATIC_SINGING_CONTACT_RADIUS, BREAKABLE_INTERACTION_HEIGHT_TOLERANCE, BREAKABLE_INTERACTION_RADIUS, EXHIBIT_APPROACH_RING_OUTER_RADIUS, isWithinAutomaticSingingContact, isWithinBreakableInteractionCircle, } from './exhibit-interaction'
import { MOVEMENT } from './movement'

const anchor = { x: 2, y: 0.7, z: -3 }

describe('exhibit interaction geometry', () => {
  it('keeps manual interaction at its larger inclusive boundary', () => {
    expect(
      isWithinBreakableInteractionCircle(
        { x: anchor.x + BREAKABLE_INTERACTION_RADIUS, z: anchor.z },
        anchor,
      ),
    ).toBe(true)
    expect(
      isWithinBreakableInteractionCircle(
        { x: anchor.x + BREAKABLE_INTERACTION_RADIUS + 0.001, z: anchor.z },
        anchor,
      ),
    ).toBe(false)
  })

  it('starts automatic singing at exact footprint contact with the visible ring', () => {
    expect(AUTOMATIC_SINGING_CONTACT_RADIUS).toBe(
      EXHIBIT_APPROACH_RING_OUTER_RADIUS + MOVEMENT.radius,
    )
    expect(
      isWithinAutomaticSingingContact(
        {
          x: anchor.x + AUTOMATIC_SINGING_CONTACT_RADIUS + 0.001,
          y: anchor.y,
          z: anchor.z,
        },
        anchor,
      ),
    ).toBe(false)
    expect(
      isWithinAutomaticSingingContact(
        {
          x: anchor.x + AUTOMATIC_SINGING_CONTACT_RADIUS,
          y: anchor.y,
          z: anchor.z,
        },
        anchor,
      ),
    ).toBe(true)
  })

  it('rejects another elevation even at the ring centre', () => {
    expect(
      isWithinAutomaticSingingContact(
        {
          x: anchor.x,
          y: anchor.y + BREAKABLE_INTERACTION_HEIGHT_TOLERANCE,
          z: anchor.z,
        },
        anchor,
      ),
    ).toBe(false)
    expect(
      isWithinAutomaticSingingContact(
        {
          x: anchor.x,
          y: anchor.y + BREAKABLE_INTERACTION_HEIGHT_TOLERANCE - 0.001,
          z: anchor.z,
        },
        anchor,
      ),
    ).toBe(true)
  })
})
