// ============================================================
// Where Merc stands for the alley's welcome
// ============================================================
//
// On the alley as RoomsAlley draws it: the picture cover-fit for each
// screen (alley-geometry.ts), its doors, and the spot the picture keeps for
// him (alley-plate.ts), at the onboarding walk's three frames and a phone
// on its side.

import { describe, expect, it } from 'vitest'
import { MERC_BODY } from '@/components/demo-kit/tip-target'
import { MERC_FEET } from '@/components/room-kit/MercView'
import type { AlleyFrame } from '../alley/alley-geometry'
import { alleyFit, layoutDoors } from '../alley/alley-geometry'
import { alleyScene } from '../alley/alley-plate'
import type { GuideInput, GuidePlace } from './alley-guide-place'
import { FIGURE_OF_DOOR, GUIDE_MIN, guidePlace, LINE_H, LINE_MAX, } from './alley-guide-place'

interface Screen {
  readonly w: number
  readonly h: number
  /** Upright, the headline block's bottom; on its side, the safe top. */
  readonly top: number
  /** The dock's top. */
  readonly floor: number
  /** On its side, the headline column's right edge. */
  readonly column?: number
}

const SCREENS: Readonly<Record<string, Screen>> = {
  'a phone upright': { w: 390, h: 844, top: 170, floor: 746 },
  'an iPad upright': { w: 820, h: 1180, top: 200, floor: 1096 },
  'an iPad on its side': { w: 1180, h: 820, top: 24, floor: 730, column: 268 },
  'a phone on its side': { w: 844, h: 390, top: 0, floor: 326, column: 268 },
}

/** The alley's measures for `screen`, as RoomsAlley hands them over. */
function inputFor(screen: Screen): GuideInput {
  const scene = alleyScene(screen.w, screen.h)
  const landscape = screen.w > screen.h
  const frame: AlleyFrame = landscape
    ? {
        top: screen.top,
        bottom: screen.floor,
        left: screen.column,
        right: screen.w,
      }
    : { top: screen.top, bottom: screen.floor }
  const fit = alleyFit(scene.plate, scene.doors, screen.w, screen.h, frame)
  const doors = layoutDoors(
    scene.plate,
    scene.doors,
    screen.w,
    screen.h,
    frame,
  )
  const door = doors.find((each) => each.key === scene.guide.door)
  if (door === undefined) throw new Error('no middle door')
  return {
    w: screen.w,
    h: screen.h,
    landscape,
    floor: screen.floor,
    top: screen.top,
    door,
    feet: fit.at(scene.guide.feet),
    doors,
  }
}

interface Box {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** His body on screen: MERC_BODY of his box, down to his feet. */
const bodyOf = (place: GuidePlace): Box => ({
  x0: place.x + MERC_BODY.x * place.size,
  x1: place.x + (MERC_BODY.x + MERC_BODY.w) * place.size,
  y0: place.y + MERC_BODY.y * place.size,
  y1: place.y + MERC_FEET * place.size,
})

/** The door's height at its middle: its two jambs, averaged. */
const doorHeight = (input: GuideInput): number => {
  const [a, b, c, d] = input.door.quad
  return (d[1] - a[1] + (c[1] - b[1])) / 2
}

const placed = (input: GuideInput): GuidePlace => {
  const place = guidePlace(input)
  if (place === null) throw new Error('not there')
  return place
}

describe('Merc in the alley (owner, 20 Oct 2026)', () => {
  for (const [name, screen] of Object.entries(SCREENS)) {
    describe(name, () => {
      const input = inputFor(screen)

      it('stands with his feet on the floor line, in front of the middle door', () => {
        const place = placed(input)

        const feetX = place.x + place.size / 2
        const feetY = place.y + MERC_FEET * place.size
        expect(Math.abs(feetX - input.feet[0])).toBeLessThanOrEqual(1)
        expect(Math.abs(feetY - input.feet[1])).toBeLessThanOrEqual(1)
        expect(feetX).toBeGreaterThan(input.door.x0)
        expect(feetX).toBeLessThan(input.door.x1)
        // In front of it: his body covers the foot of the door behind him.
        expect(overlaps(bodyOf(place), input.door)).toBe(true)
      })

      it('is sized to the door behind him, his figure a share of its height', () => {
        const place = placed(input)

        const figure = (MERC_FEET - MERC_BODY.y) * place.size
        expect(
          Math.abs(figure - FIGURE_OF_DOOR * doorHeight(input)),
        ).toBeLessThanOrEqual(1)
        expect(place.size).toBeGreaterThanOrEqual(GUIDE_MIN)
      })

      it('stands clear of every other door, and inside the screen', () => {
        const place = placed(input)
        const body = bodyOf(place)

        for (const door of input.doors) {
          if (door.key === input.door.key) continue
          expect(overlaps(body, door), door.key).toBe(false)
        }
        expect(body.x0).toBeGreaterThanOrEqual(0)
        expect(body.x1).toBeLessThanOrEqual(screen.w)
        expect(body.y0).toBeGreaterThanOrEqual(0)
      })

      it('says his line under him, centred, clear of every door, over the dock and inside the screen', () => {
        const place = placed(input)
        const line = place.line

        expect(line).not.toBeNull()
        if (line === null) return
        expect(Math.abs(line.x - input.feet[0])).toBeLessThanOrEqual(1)
        expect(line.y).toBeGreaterThan(input.feet[1])
        expect(line.width).toBeLessThanOrEqual(LINE_MAX)
        const box = {
          x0: line.x - line.width / 2,
          x1: line.x + line.width / 2,
          y0: line.y,
          y1: line.y + LINE_H,
        }
        for (const door of input.doors) {
          expect(overlaps(box, door), door.key).toBe(false)
        }
        expect(box.y1).toBeLessThanOrEqual(screen.floor - 12)
        expect(box.x0).toBeGreaterThanOrEqual(16)
        expect(box.x1).toBeLessThanOrEqual(screen.w - 16)
      })
    })
  }

  it('keeps his head under the headline upright, smaller for it', () => {
    const input = inputFor(SCREENS['a phone upright'])
    const top = input.feet[1] - 80

    const place = placed({ ...input, top })

    expect(place.y + MERC_BODY.y * place.size).toBeGreaterThanOrEqual(top)
    expect(place.size).toBeLessThan(placed(input).size)
    expect(
      Math.abs(place.y + MERC_FEET * place.size - input.feet[1]),
    ).toBeLessThanOrEqual(1)
  })

  it('is not there at all where the headline leaves too little of him', () => {
    const input = inputFor(SCREENS['a phone upright'])

    expect(guidePlace({ ...input, top: input.feet[1] - 20 })).toBeNull()
  })

  it('takes no notice of the headline on its side, which stands beside him', () => {
    const input = inputFor(SCREENS['an iPad on its side'])

    expect(placed({ ...input, top: input.feet[1] - 20 }).size).toBe(
      placed(input).size,
    )
  })

  it('says his line under a door that comes down past his feet', () => {
    const input = inputFor(SCREENS['a phone upright'])
    const low = {
      ...input.door,
      key: 'guitar' as const,
      x0: input.feet[0] - 20,
      x1: input.feet[0] + 20,
      y0: input.feet[1] - 100,
      y1: input.feet[1] + 40,
    }

    const line = placed({ ...input, doors: [...input.doors, low] }).line

    expect(line?.y ?? 0).toBeGreaterThan(low.y1)
  })

  it('has no line where the dock leaves it no room under him', () => {
    const input = inputFor(SCREENS['a phone upright'])

    const place = placed({ ...input, floor: input.feet[1] + 30 })

    expect(place.line).toBeNull()
  })
})
