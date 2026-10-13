// ============================================================
// Echo's sky layout: every room shape keeps the sky off the room's controls
// ============================================================
//
// The boxes are what the room measures at the sizes the layout check drives
// (each phone with the shell's insets), plus the shortest phone the app
// runs on. A box's clears are px from its top: the shell's bar, the chip
// row's bottom, the result's numbers' bottom.

import { describe, expect, it } from 'vitest'
import { MERC_SEAT, PLATE_BASE, RIDGE, STAR_WIDTH_W } from './echo-geometry'
import { RING_W } from './echo-scene'
import type { SkyBox, SkyLayout } from './sky-layout'
import { CONTENT_TOP_V, FINISHED_SLOTS, floorAt, inSky, K_MIN, layoutSky, onPlate, RESULT_BOXES, } from './sky-layout'

const BASE_ASPECT = PLATE_BASE.height / PLATE_BASE.width

const ROOMS: Record<string, SkyBox> = {
  '390x844': {
    width: 390,
    height: 844,
    edgeClear: 103,
    chipClear: 161,
    resultClear: 235,
  },
  '430x932': {
    width: 430,
    height: 932,
    edgeClear: 115,
    chipClear: 173,
    resultClear: 247,
  },
  '360x800': {
    width: 360,
    height: 800,
    edgeClear: 80,
    chipClear: 138,
    resultClear: 212,
  },
  '375x667': {
    width: 375,
    height: 667,
    edgeClear: 76,
    chipClear: 122,
    resultClear: 184,
  },
  '768x1024': {
    width: 768,
    height: 1024,
    edgeClear: 80,
    chipClear: 138,
    resultClear: 212,
  },
  '320x568': {
    width: 320,
    height: 568,
    edgeClear: 76,
    chipClear: 122,
    resultClear: 184,
  },
}
const SIZES = Object.keys(ROOMS)

/** px from the box's top of content at plate `v`, drawn at scale `k`. */
const topAt = (layout: SkyLayout, v: number, k: number): number =>
  inSky(layout, { u: 0.5, v }, k).y

describe("Echo's sky in a room of any shape", () => {
  it.each(SIZES)(
    'keeps the phrase and the middle finished places under the chip row at %s',
    (size) => {
      const box = ROOMS[size]
      const layout = layoutSky(box)

      expect(
        topAt(layout, CONTENT_TOP_V.phrase, layout.k),
      ).toBeGreaterThanOrEqual(box.chipClear - 0.01)
      expect(
        topAt(layout, CONTENT_TOP_V.middle, layout.k),
      ).toBeGreaterThanOrEqual(box.chipClear - 0.01)
      expect(
        topAt(layout, CONTENT_TOP_V.finished, layout.k),
      ).toBeGreaterThanOrEqual(box.edgeClear - 0.01)
      expect(
        topAt(layout, CONTENT_TOP_V.result, layout.kResult),
      ).toBeGreaterThanOrEqual(box.resultClear - 0.01)
      expect(layout.k).toBeGreaterThanOrEqual(K_MIN)
    },
  )

  it('draws the storyboard frame whole on the phones it was painted for', () => {
    for (const size of ['390x844', '430x932', '360x800']) {
      const layout = layoutSky(ROOMS[size])

      expect(layout.k).toBe(1)
      expect(layout.column.width).toBe(ROOMS[size].width)
    }
  })

  it('narrows a 16:9 phone by a few px at most, and a tablet to a column', () => {
    expect(layoutSky(ROOMS['375x667']).column.width).toBeGreaterThan(370)
    expect(layoutSky(ROOMS['768x1024']).column.width).toBeLessThan(640)
  })

  it("takes the middle places' top from the places themselves", () => {
    const top =
      Math.min(FINISHED_SLOTS[2].v0, FINISHED_SLOTS[3].v0) -
      STAR_WIDTH_W.finished / 2 / BASE_ASPECT

    expect(CONTENT_TOP_V.middle).toBeCloseTo(top, 3)
  })

  it.each(SIZES)(
    'keeps every result place over the roofs, at any scale the result draws at (%s)',
    (size) => {
      const layout = layoutSky(ROOMS[size])
      // The deepest a star or a missed ring reaches below its centre, W.
      const halfW = Math.max(STAR_WIDTH_W.result / 2, RING_W.missed)
      const below: string[] = []
      for (const k of [K_MIN * 0.8, 0.7, 0.8, 0.9, layout.kResult, 1]) {
        RESULT_BOXES.forEach((slot, i) => {
          for (let u = slot.u0; u <= slot.u1 + 1e-9; u += 0.005) {
            const at = inSky(layout, { u, v: slot.v1 }, k)
            const column = (at.x - layout.column.left) / layout.unit
            const floor = onPlate(layout, { u: column, v: floorAt(column) }).y
            if (at.y + halfW * layout.unit * k > floor + 0.5) {
              below.push(
                `place ${i + 1} at u ${u.toFixed(3)}, k ${k.toFixed(2)}`,
              )
            }
          }
        })
      }

      expect(below).toEqual([])
    },
  )

  it("seats Merc on the ridge's line", () => {
    const [[u0, v0], [u1, v1]] = RIDGE
    const ridgeV = v0 + ((v1 - v0) * (MERC_SEAT.u - u0)) / (u1 - u0)

    // Within 2 px on the storyboard's 390 x 844 frame.
    expect(Math.abs(MERC_SEAT.v - ridgeV) * BASE_ASPECT * 390).toBeLessThan(2)
  })
})
