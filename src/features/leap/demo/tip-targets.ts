// ============================================================
// What each demo tooltip points at, in the Leap room as it is drawn now
// ============================================================
//
// Merc, the band of light over the far ledge, the lantern at its end, the
// leap's lamp under the chip, the mic and the demo's own controls are
// measured off the screen as they stand, so a ledge that has just slid to
// its height is aimed at where it is. The demo kit's layer
// (demo-kit/DemoLayer.tsx) asks `aimLeapTip` where each tooltip goes. What
// every room's tooltips share (the room measured off the layer, the gaps,
// what none of them covers, the mic's target) is the kit's own
// (demo-kit/tip-target.ts).

import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, ARROW_GAP, controlsClear, mercBody, micTarget, present, roomInside, roomRects, stretchOf, stretchTarget, } from '@/components/demo-kit/tip-target'
import type { DemoTarget } from './demo-cues'

/** The far cliff's edge, a share of the scene's width (cliff-layout.ts). */
const FAR_EDGE = 0.6
/** The lantern's light reaches this far past its glass, px. */
const LANTERN_GLOW = 14

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly merc: Rect | null
  /** The band of light over the far ledge, from its edge to the lantern. */
  readonly band: Rect | null
  /** The lantern's glass. */
  readonly lantern: Rect | null
  /** The chip and the leap's lamp under it. */
  readonly head: readonly Rect[]
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** What no tooltip covers: the controls, the mic's ring, the head. */
function keepClear(scene: DemoScene): Rect[] {
  return [...controlsClear(scene.controls, scene.mic), ...scene.head]
}

/** What a tooltip had better not cover: Merc, and the lantern's light. */
function softly(scene: DemoScene): Rect[] {
  return present([
    scene.merc === null ? null : mercBody(scene.merc),
    scene.lantern === null ? null : inflate(scene.lantern, LANTERN_GLOW),
  ])
}

/** Above Merc on his ledge, or beside him. */
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
    prefer: present([scene.band]),
    glow: null,
  }
}

/** Beside the lantern, on the room's side of it, or under or over it. */
function lanternTarget(scene: DemoScene): TipTarget | null {
  const glass = scene.lantern
  if (glass === null) return null
  const light = inflate(glass, LANTERN_GLOW)
  const midY = glass.y + glass.h / 2
  return {
    anchors: {
      left: { x: light.x - ARROW_GAP, y: midY },
      above: { x: glass.x + glass.w / 2, y: light.y - ARROW_GAP },
      below: { x: glass.x + glass.w / 2, y: light.y + light.h + ARROW_GAP },
    },
    sides: ['left', 'above', 'below'],
    avoid: present([light, scene.band, ...keepClear(scene)]),
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
    case 'band':
      return stretchTarget(scene.band, null, [
        ...keepClear(scene),
        ...softly(scene),
      ])
    case 'lantern':
      return lanternTarget(scene)
    case 'mic':
      // Beside the mic, clear of its ring and of the pill over it.
      return micTarget(scene.mic, {
        avoid: scene.controls,
        prefer: softly(scene),
      })
  }
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureLeapScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  const room = roomInside(rects)
  const scene = id('leap-scene')
  const band = id('leap-band')
  const lantern = id('leap-lantern')
  return {
    room,
    merc: id('leap-merc'),
    // The band runs from the near side to the lantern: its far stretch is
    // the far ledge's, where the leap lands.
    band:
      scene === null || band === null
        ? null
        : stretchOf(
            room,
            scene.x + scene.w * FAR_EDGE,
            lantern === null ? band.x + band.w : lantern.x - LANTERN_GLOW,
            band.y,
            band.y + band.h,
          ),
    lantern,
    head: present([id('leap-chip'), id('leap-lamp')]),
    mic: id('leap-mic'),
    controls: present([
      id('leap-demo-skip'),
      id('leap-ask'),
      id('leap-demo-take'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimLeapTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  return aimIn(measureLeapScene(layer), (scene) => tipTarget(target, scene))
}
