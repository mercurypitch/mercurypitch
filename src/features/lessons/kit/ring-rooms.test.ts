// ============================================================
// Ring of rooms tests — the kit's spiral mounted from above as the ring of rooms
// ============================================================
//
// The mount sees the ring from above from its first frame, holds it still
// and lights its five black keys, so each carries its sharp; a ring the
// page plays from chips is mounted inert, a picture with no slider, no
// keys and no value said (Lesson 27's WEB-SPEC, What the kit and the app
// still need, item 4, and Toys 1).

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { mountRing, RING_BLACK } from './ring-rooms'

describe('the ring of rooms, mounted', () => {
  it('mounts the spiral from above, still, its five black keys lit', () => {
    // Arrange
    document.body.innerHTML = '<div id="v"><canvas></canvas></div>'
    const viz = document.getElementById('v') as HTMLElement

    // Act
    const spiral = mountRing(viz, {
      active: () => false,
      overlay: () => undefined,
      overlayWants: () => false,
    })

    // Assert
    expect([...spiral.lit].sort((a, b) => a - b)).toEqual([...RING_BLACK])
    expect(spiral.top).toBe(1)
    const canvas = viz.querySelector('canvas')
    expect(canvas?.tabIndex).toBe(0)
    expect(canvas?.getAttribute('aria-valuetext')).toMatch(/hertz$/)
  })

  it('mounts an inert ring as a picture: no keys, no slider, no value said', () => {
    // Arrange
    document.body.innerHTML =
      '<div id="v"><canvas role="img" aria-label="The ring"></canvas></div>'
    const viz = document.getElementById('v') as HTMLElement

    // Act
    const spiral = mountRing(viz, {
      active: () => false,
      overlay: () => undefined,
      overlayWants: () => false,
      inert: true,
    })
    const canvas = viz.querySelector('canvas')
    const before = spiral.selected
    canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))

    // Assert: from above, its black keys lit, and nothing a slider has
    expect(spiral.top).toBe(1)
    expect(spiral.lit.size).toBe(5)
    expect(canvas?.hasAttribute('tabindex')).toBe(false)
    for (const a of ['aria-valuenow', 'aria-valuetext', 'aria-valuemin'])
      expect(canvas?.hasAttribute(a)).toBe(false)
    expect(spiral.selected).toBe(before)
  })
})
