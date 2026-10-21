// Journey plaque placement tests — real desktop rail bounds preserve the pod badge and title.

import { describe, expect, it } from 'vitest'
import { journeyPlaquePlacement } from './journey-plaque-placement'

const viewport = { left: 0, top: 0, right: 1440, bottom: 900 }
const firstLightButton = { left: 202, top: 740, right: 246, bottom: 784 }
const rail = { left: 28, top: 820, right: 385.609375, bottom: 874 }
const card = { left: 852, top: 658, right: 1412, bottom: 874 }

describe('museum title containment', () => {
  it('places the ordinary desktop First Light title beside its badge when the bottom rail blocks it', () => {
    // Actual candidate004 DOM: below is y784..842.375 and overlaps the rail by22.375px.
    expect(
      journeyPlaquePlacement(firstLightButton, 150, 58.375, viewport, [
        rail,
        card,
      ]),
    ).toBe('right')
  })

  it('keeps the below-badge title when the original clear placement fits', () => {
    expect(
      journeyPlaquePlacement(
        { left: 996, top: 415, right: 1040, bottom: 459 },
        150,
        58.375,
        viewport,
        [rail, card],
      ),
    ).toBe('below')
  })

  it('tries the left side when the right side would leave the viewport', () => {
    expect(
      journeyPlaquePlacement(
        { left: 1300, top: 740, right: 1344, bottom: 784 },
        150,
        58.375,
        viewport,
        [rail, { left: 1200, top: 800, right: 1440, bottom: 900 }],
      ),
    ).toBe('left')
  })

  it('hides only the duplicate title when the viewport and fixed controls leave no clear position', () => {
    expect(
      journeyPlaquePlacement(firstLightButton, 150, 58.375, viewport, [
        rail,
        { left: 0, top: 700, right: 1440, bottom: 800 },
      ]),
    ).toBe('hidden')
  })
})
