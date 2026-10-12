import { describe, expect, it } from 'vitest'
import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate, overlapArea, placeTip } from '@/components/demo-kit/tip-place'
import { HOLD_FILL_MAX, LANTERN_VIEW_H, surfaceY } from '../lantern-geometry'
import type { DemoScene } from './tip-targets'
import { bailRect, tipTarget } from './tip-targets'

// The room as the demo measured it on two phones (px from the room's top
// left, round 4): the end of take 1, and take 2's result.
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

const RESULT_360: Partial<DemoScene> = {
  result: { x: 116.1, y: 6, w: 127.7, h: 69.6 },
  score: { x: 117, y: 54, w: 126, h: 21.6 },
}

const RESULT_390: DemoScene = {
  room: { x: 0, y: 0, w: 390, h: 699 },
  stage: { x: 0, y: 132, w: 390, h: 373 },
  lantern: { x: 88.1, y: 146.9, w: 179, h: 358.1 },
  note: { x: 340, y: 294.5, w: 44, h: 44 },
  timer: null,
  chip: null,
  result: { x: 113.9, y: 14, w: 162.3, h: 83.6 },
  score: { x: 132, y: 76, w: 126, h: 21.6 },
  mic: { x: 153, y: 587, w: 84, h: 84 },
  picker: null,
  merc: { x: 200, y: 325.9, w: 188, h: 188 },
  controls: [
    { x: 320, y: 136, w: 64, h: 44 },
    { x: 135.5, y: 519, w: 119, h: 36 },
  ],
  level: 0.54,
}

/**
 * A tooltip's text at 13 px as the phone set it: 7.1 px a character,
 * wrapped at word breaks, 17.55 px a line inside an 18 px frame.
 */
function textOf(text: string) {
  return (maxWidth: number): { w: number; h: number } => {
    const room = Math.floor((maxWidth - 18) / 7.1)
    const lines: string[] = []
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1]
      if (last !== undefined && last.length + 1 + word.length <= room) {
        lines[lines.length - 1] = `${last} ${word}`
      } else lines.push(word)
    }
    const widest = Math.max(...lines.map((line) => line.length))
    return {
      w: Math.min(maxWidth, 18 + 7.1 * widest),
      h: 18 + 17.55 * lines.length,
    }
  }
}

const BREATH_PASS_3 = 'Stop for a breath and the note is over.'
const SCORE = 'Steadier holds score higher.'

function placed(
  target: ReturnType<typeof tipTarget>,
  text: string,
  room: Rect,
) {
  if (target === null) throw new Error('no target')
  const place = placeTip({
    ...target,
    bounds: room,
    maxWidth: 240,
    maxHeight: 18 + 17.55 * 3 + 1,
    size: textOf(text),
  })
  if (place === null) throw new Error('no place')
  return place
}

describe('tipTarget', () => {
  it("keeps a tooltip under the timer off the lantern's handle", () => {
    // Review of pass 3: at 360 x 640, "Stop for a breath and the note is
    // over." (two lines under the timer) covered the top 11 px of the
    // handle. Whatever the words, no place may.
    const scene = scene360({ timer: { x: 129.7, y: 6, w: 100.6, h: 44 } })
    const tip = placed(tipTarget('timer', scene), BREATH_PASS_3, scene.room)
    expect(overlapArea(tip.box, bailRect(LANTERN_360))).toBe(0)
    expect(tip.clear).toBe(true)
  })

  it('puts the steadiness tip under the score when the handle leaves room, else beside it away from Skip', () => {
    // 390 x 844: one line under "Steadiness 99", clear of the handle.
    const wide = placed(tipTarget('score', RESULT_390), SCORE, RESULT_390.room)
    expect(wide.side).toBe('below')
    expect(
      overlapArea(wide.box, bailRect(RESULT_390.lantern ?? LANTERN_360)),
    ).toBe(0)

    // 360 x 640: 25 px between the score and the handle, where one line
    // needs 46. Beside the score, on the side away from Skip.
    const scene = scene360(RESULT_360)
    const narrow = placed(tipTarget('score', scene), SCORE, scene.room)
    expect(narrow.side).toBe('left')
    expect(overlapArea(narrow.box, bailRect(LANTERN_360))).toBe(0)
    expect(narrow.box.x + narrow.box.w).toBeLessThan(SKIP_360.x - 100)
  })

  it("keeps clear of the demo's controls by 8 px", () => {
    // Review of pass 3: the score tip sat 2 px above Skip.
    const target = tipTarget('score', scene360(RESULT_360))
    expect(target?.avoid).toContainEqual(inflate(SKIP_360, 8))
  })

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
