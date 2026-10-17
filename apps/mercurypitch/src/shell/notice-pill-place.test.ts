import { describe, expect, it } from 'vitest'
import type { Box } from './notice-pill-place'
import { PILL_CLEARANCE, PILL_MAX_WIDTH, PILL_TOP_GAP, placePill, } from './notice-pill-place'

/** A 44 px control at `left`, in the header row under a status bar. */
function control(left: number, top: number, width = 44, height = 44): Box {
  return { left, top, right: left + width, bottom: top + height }
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  )
}

function pillBox(place: ReturnType<typeof placePill>, height: number): Box {
  return {
    left: place.left,
    top: place.top,
    right: place.left + place.width,
    bottom: place.top + height,
  }
}

describe('placePill', () => {
  it('sits centred under the status bar, between Back and the gear', () => {
    // 390 x 844 under a 47 px notch: Back at 12, the gear at 334.
    const controls = [control(12, 51), control(334, 51)]
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeBottom: 0,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls,
    })
    expect(place.docked).toBe('top')
    expect(place.top).toBe(47 + PILL_TOP_GAP)
    expect(place.left + place.width / 2).toBeCloseTo(195, 0)
    for (const box of controls) {
      expect(overlaps(pillBox(place, 40), box)).toBe(false)
    }
    // As wide as the gap allows, less the clearance each side.
    expect(place.width).toBe(390 - 2 * (56 + PILL_CLEARANCE))
  })

  it('stops at its tablet width on a wide header', () => {
    const place = placePill({
      viewportWidth: 1024,
      viewportHeight: 1366,
      safeBottom: 0,
      safeTop: 24,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls: [control(12, 28), control(968, 28)],
    })
    expect(place.width).toBe(PILL_MAX_WIDTH)
    expect(place.docked).toBe('top')
  })

  it('steps below a header whose centre is a button', () => {
    // The Sing room: Back, the room chip (a picker) in the middle, the gear.
    const controls = [
      control(12, 51),
      control(130, 51, 130, 44),
      control(334, 51),
    ]
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeBottom: 0,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls,
    })
    expect(place.docked).toBe('below')
    expect(place.top).toBe(51 + 44 + PILL_CLEARANCE)
    for (const box of controls) {
      expect(overlaps(pillBox(place, 40), box)).toBe(false)
    }
  })

  it('steps below a bar whose actions leave too narrow a gap', () => {
    // A premium room's bar: Back, then the level pill and "?" on the right.
    const controls = [
      control(12, 51),
      control(214, 51, 112, 44),
      control(334, 51),
    ]
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeBottom: 0,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls,
    })
    expect(place.docked).toBe('below')
    for (const box of controls) {
      expect(overlaps(pillBox(place, 40), box)).toBe(false)
    }
  })

  it('keeps stepping until the band is clear', () => {
    // A header, then a row of chips under it that also fills the centre.
    const controls = [control(150, 51, 90, 44), control(40, 103, 310, 36)]
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeBottom: 0,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls,
    })
    expect(place.top).toBe(139 + PILL_CLEARANCE)
    for (const box of controls) {
      expect(overlaps(pillBox(place, 40), box)).toBe(false)
    }
  })

  it('keeps inside the side insets of a phone on its side', () => {
    const place = placePill({
      viewportWidth: 844,
      viewportHeight: 390,
      safeBottom: 0,
      safeTop: 0,
      safeLeft: 47,
      safeRight: 47,
      pillHeight: 40,
      controls: [control(59, 4), control(741, 4)],
    })
    expect(place.left).toBeGreaterThanOrEqual(47)
    expect(place.left + place.width).toBeLessThanOrEqual(844 - 47)
    expect(place.width).toBe(PILL_MAX_WIDTH)
  })

  it('ignores a control well below the band', () => {
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeBottom: 0,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      pillHeight: 40,
      controls: [control(100, 400, 190, 44)],
    })
    expect(place.docked).toBe('top')
  })

  it('never steps below the bottom of the safe area', () => {
    // A column of full-width rows down a short screen.
    const controls = [0, 1, 2, 3, 4, 5].map((row) =>
      control(12, 4 + row * 56, 366, 48),
    )
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 360,
      safeTop: 0,
      safeLeft: 0,
      safeRight: 0,
      safeBottom: 20,
      pillHeight: 44,
      controls,
    })
    expect(place.top + 44).toBeLessThanOrEqual(360 - 20)
  })

  it('lies over a list with no clear band at its widest, letting taps through', () => {
    // The song picker on a phone: a dialog's header, then rows from edge to
    // edge all the way down, and a three-line notice with an action.
    const controls = [
      control(321, 90, 44, 44),
      ...Array.from({ length: 10 }, (_, row) =>
        control(25, 148 + row * 64, 340, 60),
      ),
    ]
    const place = placePill({
      viewportWidth: 390,
      viewportHeight: 844,
      safeTop: 47,
      safeLeft: 0,
      safeRight: 0,
      safeBottom: 34,
      pillHeight: 100,
      controls,
    })
    expect(place.docked).toBe('over')
    expect(place.top).toBe(47 + PILL_TOP_GAP)
    // As wide as the screen allows, so as short as it can be.
    expect(place.width).toBe(390 - 24)
    expect(place.left).toBe(12)
  })

  it('takes the widest gap when every band is blocked across the middle', () => {
    // Karaoke on a phone's side: the room chip mid-header, then rows of
    // controls that cross the centre all the way down.
    const controls = [
      control(47, 4),
      control(340, 4, 165, 44),
      control(753, 4),
      control(47, 52, 286, 46),
      control(300, 104, 300, 40),
      control(100, 152, 700, 40),
      control(47, 200, 750, 40),
    ]
    const place = placePill({
      viewportWidth: 844,
      viewportHeight: 390,
      safeTop: 0,
      safeLeft: 47,
      safeRight: 47,
      safeBottom: 21,
      pillHeight: 44,
      controls,
    })
    expect(place.top + 44).toBeLessThanOrEqual(390)
    expect(place.width).toBeGreaterThanOrEqual(200)
    for (const box of controls) {
      expect(overlaps(pillBox(place, 44), box)).toBe(false)
    }
  })
})
