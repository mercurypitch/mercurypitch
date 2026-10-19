// ============================================================
// Where Merc stands for the alley's welcome
// ============================================================

import { describe, expect, it } from 'vitest'
import { MERC_FEET } from '@/components/room-kit/MercView'
import type { GuideInput } from './alley-guide-place'
import { GUIDE_MAX, GUIDE_MIN, guidePlace, LINE_MAX } from './alley-guide-place'

/** A phone upright: six doors stepping down to the right, the dock under. */
const PHONE: GuideInput = {
  w: 390,
  h: 844,
  landscape: false,
  floor: 746,
  top: 170,
  left: 16,
  right: 374,
  doors: [
    { x0: 0, x1: 30, y1: 503 },
    { x0: 38, x1: 74, y1: 518 },
    { x0: 85, x1: 130, y1: 534 },
    { x0: 144, x1: 200, y1: 560 },
    { x0: 225, x1: 278, y1: 601 },
    { x0: 310, x1: 420, y1: 686 },
  ],
}

const overlaps = (
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number },
): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

describe('Merc in the alley', () => {
  it('stands on the cobbles at the bottom left upright, under every door, his feet over the dock', () => {
    const place = guidePlace(PHONE)

    expect(place).not.toBeNull()
    if (place === null) return
    expect(place.x).toBe(16)
    expect(place.size).toBeGreaterThanOrEqual(GUIDE_MIN)
    expect(place.size).toBeLessThanOrEqual(Math.round(0.3 * 390))
    const feet = place.y + MERC_FEET * place.size
    expect(feet).toBeLessThanOrEqual(PHONE.floor)
    const box = {
      x0: place.x,
      x1: place.x + place.size,
      y0: place.y,
      y1: place.y + place.size,
    }
    for (const door of PHONE.doors) {
      expect(overlaps(box, { ...door, y0: 0 })).toBe(false)
    }
  })

  it('says his line beside him, clear of the doors and inside the screen', () => {
    const place = guidePlace(PHONE)
    const line = place?.line ?? null

    expect(line).not.toBeNull()
    if (place === null || line === null) return
    expect(line.x).toBeGreaterThan(place.x + place.size / 2)
    expect(line.x + line.width).toBeLessThanOrEqual(PHONE.w - 16)
    expect(line.width).toBeLessThanOrEqual(LINE_MAX)
    // Its two lines, at most, clear of the doors over it.
    const box = {
      x0: line.x,
      x1: line.x + line.width,
      y0: line.y - 24,
      y1: line.y + 24,
    }
    for (const door of PHONE.doors) {
      expect(overlaps(box, { ...door, y0: 0 })).toBe(false)
    }
  })

  it('stands bigger on an iPad, up to his most', () => {
    const place = guidePlace({
      ...PHONE,
      w: 820,
      h: 1180,
      floor: 1096,
      doors: PHONE.doors.map((door) => ({
        ...door,
        x0: door.x0 * 2,
        x1: door.x1 * 2,
      })),
    })

    expect(place?.size).toBe(GUIDE_MAX)
  })

  it('stands in the headline column on its side, under the headline, his line in the column', () => {
    const place = guidePlace({
      w: 844,
      h: 390,
      landscape: true,
      floor: 326,
      top: 150,
      left: 16,
      right: 268,
      doors: [{ x0: 300, x1: 380, y1: 300 }],
    })

    expect(place).not.toBeNull()
    if (place === null) return
    expect(place.x).toBe(16)
    expect(place.y).toBeGreaterThanOrEqual(150)
    expect(place.y + MERC_FEET * place.size).toBeLessThanOrEqual(326)
    expect(place.line).not.toBeNull()
    expect((place.line?.x ?? 0) + (place.line?.width ?? 0)).toBeLessThanOrEqual(
      268 - 16,
    )
  })

  it('is not there at all where the room under the doors is too small for him', () => {
    expect(guidePlace({ ...PHONE, floor: 640 })).toBeNull()
  })

  it('stands without his line where there is no room beside him', () => {
    const place = guidePlace({
      w: 844,
      h: 390,
      landscape: true,
      floor: 326,
      top: 150,
      left: 16,
      right: 200,
      doors: [],
    })

    expect(place).not.toBeNull()
    expect(place?.line).toBeNull()
  })
})
