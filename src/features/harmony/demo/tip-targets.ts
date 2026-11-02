// ============================================================
// What each demo tooltip points at, in the Harmony room as it is drawn now
// ============================================================
//
// Merc on the jetty, the harmony's gold lamps, the one that missed, the
// mic and the demo's own controls are measured off the screen as they
// stand, so lamps laid out for the demo's line are aimed at where they
// are. The demo kit's layer (demo-kit/DemoLayer.tsx) asks `aimHarmonyTip`
// where each tooltip goes. What every room's tooltips share (the room
// measured off the layer, the gaps, what none of them covers, the mic's
// target) is the kit's own (demo-kit/tip-target.ts).

import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { RoomRects, TipAim, TipTarget, } from '@/components/demo-kit/tip-target'
import { aimIn, around, ARROW_GAP, controlsClear, mercBody, micTarget, present, roomInside, roomRects, stretchTarget, } from '@/components/demo-kit/tip-target'
import type { DemoTarget } from './demo-cues'

/** A lamp's light reaches this far past its ring, px. */
const LAMP_GLOW = 10

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly merc: Rect | null
  /** The harmony's gold lamps, from the first to the last. */
  readonly lamps: Rect | null
  /** The first of them that missed. */
  readonly missed: Rect | null
  /** The chip and the task under it. */
  readonly head: readonly Rect[]
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** An element of the room, px from the layer's top left; null when unseen. */
function rectOf(rects: RoomRects, el: Element): Rect | null {
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    x: r.left - rects.origin.x,
    y: r.top - rects.origin.y,
    w: r.width,
    h: r.height,
  }
}

/** The first element `selector` finds (the lamps run in the line's order); null for none. */
function firstOf(rects: RoomRects, selector: string): Rect | null {
  const el = rects.root.querySelector(selector)
  return el === null ? null : rectOf(rects, el)
}

/** Every element `selector` finds, as one box; null for none. */
function boxOf(rects: RoomRects, selector: string): Rect | null {
  const all = present(
    [...rects.root.querySelectorAll(selector)].map((el) => rectOf(rects, el)),
  )
  if (all.length === 0) return null
  const x0 = Math.min(...all.map((r) => r.x))
  const y0 = Math.min(...all.map((r) => r.y))
  const x1 = Math.max(...all.map((r) => r.x + r.w))
  const y1 = Math.max(...all.map((r) => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** What no tooltip covers: the controls, the mic's ring, the head. */
function keepClear(scene: DemoScene): Rect[] {
  return [...controlsClear(scene.controls, scene.mic), ...scene.head]
}

/** What a tooltip had better not cover: Merc. */
function softly(scene: DemoScene): Rect[] {
  return present([scene.merc === null ? null : mercBody(scene.merc)])
}

/** Above Merc on the jetty, or beside him. */
function mercTarget(scene: DemoScene): TipTarget | null {
  if (scene.merc === null) return null
  const body = mercBody(scene.merc)
  return {
    anchors: {
      above: { x: body.x + body.w / 2, y: body.y - ARROW_GAP },
      right: { x: body.x + body.w + ARROW_GAP, y: body.y + body.h * 0.4 },
    },
    sides: ['above', 'right'],
    avoid: [body, ...keepClear(scene)],
    prefer: present([scene.lamps]),
    glow: null,
  }
}

/** Over the lamp that missed, or under it, its light glowing. */
function missedTarget(scene: DemoScene): TipTarget | null {
  if (scene.missed === null) return null
  const light = inflate(scene.missed, LAMP_GLOW)
  return {
    anchors: around(light, ARROW_GAP),
    sides: ['above', 'below'],
    avoid: present([light, ...keepClear(scene)]),
    prefer: softly(scene),
    glow: { kind: 'light', rect: light },
  }
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  switch (target) {
    case 'merc':
      return mercTarget(scene)
    case 'lamps':
      return stretchTarget(scene.lamps, null, [
        ...keepClear(scene),
        ...softly(scene),
      ])
    case 'missed':
      return missedTarget(scene)
    case 'mic':
      // Beside the mic, clear of its ring and of the pill over it.
      return micTarget(scene.mic, {
        avoid: scene.controls,
        prefer: softly(scene),
      })
  }
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureHarmonyScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  return {
    room: roomInside(rects),
    merc: id('harmony-merc'),
    lamps: boxOf(rects, '[data-testid="harmony-lamp"][data-shown="true"]'),
    missed: firstOf(rects, '[data-testid="harmony-lamp"][data-state="missed"]'),
    head: present([id('harmony-chip'), id('harmony-task')]),
    mic: id('harmony-mic'),
    controls: present([
      id('harmony-demo-skip'),
      id('harmony-ask'),
      id('harmony-demo-take'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimHarmonyTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  return aimIn(measureHarmonyScene(layer), (scene) => tipTarget(target, scene))
}
