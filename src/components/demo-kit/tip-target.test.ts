// ============================================================
// tip-target: what every room's demo tooltips share
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { Rect } from './tip-place'
import type { TipTarget } from './tip-target'
import { aimIn, around, ARROW_GAP, controlsClear, mercBody, micTarget, partOf, present, roomInside, roomRects, stretchOf, stretchTarget, } from './tip-target'

/** `el` measures as `rect` on the screen. */
function placeAt(el: Element, rect: Rect): void {
  el.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
}

/**
 * A room 390 x 844 at (10, 20) on the screen: its layer over it, a mic in
 * it, and a part that is not shown.
 */
function room(style = ''): { root: HTMLElement; layer: HTMLElement } {
  const root = document.createElement('div')
  root.setAttribute('style', style)
  const mic = document.createElement('button')
  mic.dataset.testid = 'room-mic'
  const hidden = document.createElement('span')
  hidden.dataset.testid = 'room-hidden'
  const layer = document.createElement('div')
  placeAt(mic, { x: 163, y: 718, w: 84, h: 84 })
  placeAt(hidden, { x: 0, y: 0, w: 0, h: 0 })
  placeAt(layer, { x: 10, y: 20, w: 390, h: 844 })
  root.append(mic, hidden, layer)
  document.body.append(root)
  return { root, layer }
}

const MIC: Rect = { x: 153, y: 698, w: 84, h: 84 }
const MIC_RING_BOX: Rect = { x: 139, y: 684, w: 112, h: 112 }
const SKIP: Rect = { x: 300, y: 10, w: 64, h: 44 }

afterEach(() => {
  document.body.replaceChildren()
})

describe('roomRects', () => {
  it('measures the room, and each part by its test id, from the layer over it', () => {
    const { root, layer } = room()

    const rects = roomRects(layer)

    expect(rects?.room).toEqual({ x: 0, y: 0, w: 390, h: 844 })
    expect(rects?.origin).toEqual({ x: 10, y: 20 })
    expect(rects?.root).toBe(root)
    expect(rects?.byTestId('room-mic')).toEqual(MIC)
    expect(rects?.byTestId('room-hidden')).toBeNull()
    expect(rects?.byTestId('room-missing')).toBeNull()
  })

  it('has no room for a layer that is in none', () => {
    expect(roomRects(document.createElement('div'))).toBeNull()
  })
})

describe('roomInside', () => {
  it("keeps a full-bleed room's tooltips inside its padding", () => {
    const { layer } = room('padding-top: 47px; padding-bottom: 34px')
    const rects = roomRects(layer)

    expect(rects === null ? null : roomInside(rects)).toEqual({
      x: 0,
      y: 47,
      w: 390,
      h: 763,
    })
  })

  it('is the whole room when the room has no padding', () => {
    const rects = roomRects(room().layer)

    expect(rects === null ? null : roomInside(rects)).toEqual({
      x: 0,
      y: 0,
      w: 390,
      h: 844,
    })
  })
})

describe("a target's parts", () => {
  it('keeps the parts that are shown, in order', () => {
    expect(present([MIC, null, SKIP, null])).toEqual([MIC, SKIP])
  })

  it('reads a part of a box as fractions of the box', () => {
    const box = { x: 100, y: 200, w: 200, h: 100 }

    expect(partOf(box, { x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
      x: 150,
      y: 250,
      w: 100,
      h: 25,
    })
  })

  it("finds Merc's body in his canvas, which is mostly clear around him", () => {
    const body = mercBody({ x: 100, y: 200, w: 200, h: 100 })

    expect(body.x).toBeCloseTo(152, 9)
    expect(body.y).toBeCloseTo(230, 9)
    expect(body.w).toBeCloseTo(96, 9)
    expect(body.h).toBeCloseTo(58, 9)
  })

  it("puts the arrow on every side of a box, the arrow's gap off it", () => {
    const box = { x: 10, y: 20, w: 100, h: 40 }

    expect(around(box)).toEqual({
      above: { x: 60, y: 16 },
      below: { x: 60, y: 64 },
      left: { x: 6, y: 40 },
      right: { x: 114, y: 40 },
    })
    expect(around(box, 0).above).toEqual({ x: 60, y: 20 })
  })

  it("keeps every tooltip off the demo's controls and the mic's ring", () => {
    const skipClear = { x: 292, y: 2, w: 80, h: 60 }

    expect(controlsClear([SKIP], MIC)).toEqual([skipClear, MIC_RING_BOX])
    expect(controlsClear([SKIP], null)).toEqual([skipClear])
  })
})

describe('micTarget', () => {
  it('points over the mic, else beside it, clear of its ring and of what is over it', () => {
    const pill = { x: 122, y: 646, w: 145, h: 36 }
    const merc = { x: 20, y: 400, w: 90, h: 90 }

    expect(micTarget(MIC, { avoid: [pill, null], prefer: [merc] })).toEqual({
      anchors: {
        above: { x: 195, y: 684 },
        right: { x: 251, y: 740 },
        left: { x: 139, y: 740 },
      },
      sides: ['above', 'right', 'left'],
      avoid: [MIC_RING_BOX, pill],
      prefer: [merc],
      glow: null,
    })
  })

  it("tries a room's own sides in its own order", () => {
    const target = micTarget(MIC, {
      sides: ['right', 'left', 'above'],
      avoid: [],
      prefer: [],
    })

    expect(target?.sides).toEqual(['right', 'left', 'above'])
  })

  it('points at nothing with no mic on the screen', () => {
    expect(micTarget(null, { avoid: [], prefer: [] })).toBeNull()
  })
})

describe('a stretch of the world', () => {
  const inside: Rect = { x: 0, y: 47, w: 390, h: 763 }

  it('cuts a stretch to the room, and drops one with too little of it on the screen', () => {
    expect(stretchOf(inside, -40, 120, 300, 420)).toEqual({
      x: 0,
      y: 300,
      w: 120,
      h: 120,
    })
    expect(stretchOf(inside, 300, 500, 300, 420)).toEqual({
      x: 300,
      y: 300,
      w: 90,
      h: 120,
    })
    expect(stretchOf(inside, 388, 500, 300, 420)).toBeNull()
  })

  it('points above or under a lit stretch, covering none of it, its glow past its edges', () => {
    const stretch = { x: 100, y: 300, w: 80, h: 120 }
    const whole = { x: 40, y: 300, w: 300, h: 120 }
    const chip = { x: 140, y: 120, w: 110, h: 32 }

    expect(stretchTarget(stretch, whole, [chip])).toEqual({
      anchors: around(stretch, ARROW_GAP),
      sides: ['above', 'below'],
      avoid: [stretch, chip],
      prefer: [whole],
      glow: { kind: 'light', rect: { x: 94, y: 294, w: 92, h: 132 } },
    })
    expect(stretchTarget(stretch, null, [])?.prefer).toEqual([])
    expect(stretchTarget(null, whole, [chip])).toBeNull()
  })
})

describe('aimIn', () => {
  it("aims at the target inside the scene's room; nothing with no scene or no target", () => {
    const scene = { room: { x: 0, y: 47, w: 390, h: 763 }, level: 0.5 }
    const target: TipTarget = {
      anchors: { above: { x: 195, y: 684 } },
      sides: ['above'],
      avoid: [],
      prefer: [],
      glow: null,
    }

    expect(aimIn(scene, () => target)).toEqual({ target, bounds: scene.room })
    expect(aimIn(scene, () => null)).toBeNull()
    expect(aimIn<typeof scene>(null, () => target)).toBeNull()
  })
})
