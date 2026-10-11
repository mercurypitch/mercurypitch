import { describe, expect, it } from 'vitest'
import { HOLD_FILL_MAX, LANTERN_VIEW_H, surfaceY } from '../lantern-geometry'
import type { Rect } from './tip-place'
import type { DemoScene } from './tip-targets'
import { tipTarget } from './tip-targets'

// The room as the demo measured it on a 360 x 640 phone (px from the
// room's top left, round 4).
const SKIP_360: Rect = { x: 290, y: 92, w: 64, h: 44 }
const LANTERN_360: Rect = { x: 119.3, y: 98.1, w: 121.4, h: 242.9 }

function scene360(over: Partial<DemoScene>): DemoScene {
  return {
    room: { x: 0, y: 0, w: 360, h: 495 },
    stage: { x: 0, y: 88, w: 360, h: 253 },
    lantern: LANTERN_360,
    note: { x: 310, y: 184, w: 44, h: 44 },
    timer: null,
    chip: null,
    result: null,
    score: null,
    mic: { x: 148, y: 411, w: 64, h: 64 },
    picker: null,
    merc: { x: 195.2, y: 219.5, w: 127.5, h: 127.5 },
    controls: [SKIP_360, { x: 107.5, y: 351, w: 145, h: 36 }],
    level: 0.2,
    ...over,
  }
}

describe('tipTarget', () => {
  it('points "12 seconds fill it halfway" at the goal\'s height, wherever the light is', () => {
    for (const level of [0, 0.1, 0.54]) {
      const target = tipTarget('half', scene360({ level }))
      const y =
        LANTERN_360.y +
        (surfaceY(HOLD_FILL_MAX) / LANTERN_VIEW_H) * LANTERN_360.h
      expect(target?.anchors.left?.y).toBeCloseTo(y, 6)
      expect(target?.anchors.right?.y).toBeCloseTo(y, 6)
    }
  })
})
