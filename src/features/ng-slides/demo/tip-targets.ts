// ============================================================
// What each demo tooltip points at, in the Ng slides room as drawn now
// ============================================================
//
// The first arch's glass is measured off the screen where the scroll has
// it now (BridgeScene's `[data-arch="0"]` holder, which moves with the
// bridge), and its rim is read from the plate's frame in W: the apex and
// the deck (bridge-geometry.ts, ARCH and PLATES). The playhead is fixed at
// PLAYHEAD_X of the room's width; the glass under it is what the voice is
// lighting now. Merc, the chip, the mic and the demo's own controls are
// measured as they stand. The demo kit's layer (demo-kit/DemoLayer.tsx)
// asks `aimNgTip` where each tooltip goes.
//
// No tooltip covers the room's controls (Skip, "?", the take's pill, the
// mic and its ring), Merc's body, the chip, or the glass it explains.
// What every room's tooltips share (the room measured off the layer, the
// gaps, the mic's target, a lit stretch of the world) is the demo kit's
// (demo-kit/tip-target.ts).

import type { Point, Rect } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, controlsClear, mercBody, micTarget, present, roomInside, roomRects, stretchOf, stretchTarget, } from '@/components/demo-kit/tip-target'
import { ARCH, PLATES, PLAYHEAD_X } from '../bridge-geometry'
import type { DemoTarget } from './demo-cues'

/** The first arch's glass on screen: its rim's apex and its deck, px. */
export interface ArchMark {
  /** The apex's x, px from the room's left. */
  readonly apexX: number
  /** Half the arch's span, px. */
  readonly halfWidth: number
  /** The top of the glass (the apex) and the deck it stands on, px. */
  readonly top: number
  readonly deck: number
}

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly arch: ArchMark | null
  /** The playhead's x, px: where the voice lights the glass now. */
  readonly playheadX: number
  readonly merc: Rect | null
  readonly chip: Rect | null
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** The glass lit around the playhead, W behind it and ahead of it. */
const PLAYHEAD_BEHIND_W = 0.12
const PLAYHEAD_AHEAD_W = 0.02
/** The top note's glass: the flat top and a little either side, of a. */
const TOP_REACH = ARCH.f + 0.12

/** The glass from x0 to x1 (px), apex to deck, kept on the screen. */
function glassBand(
  scene: DemoScene,
  arch: ArchMark,
  x0: number,
  x1: number,
): Rect | null {
  return stretchOf(scene.room, x0, x1, arch.top, arch.deck)
}

/**
 * What no tooltip covers: the room's controls and the demo's own (with a
 * gap), the mic's ring, the chip and Merc.
 */
function keepClear(scene: DemoScene): Rect[] {
  return [
    ...controlsClear(scene.controls, scene.mic),
    ...present([scene.chip, scene.merc === null ? null : mercBody(scene.merc)]),
  ]
}

/**
 * A stretch of the glass: above it in the sky or under it over the water,
 * covering none of it, and as little of the rest of the arch as it can.
 */
function glassTarget(
  scene: DemoScene,
  band: Rect | null,
  whole: Rect | null,
): TipTarget | null {
  return stretchTarget(band, whole, keepClear(scene))
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  if (target === 'mic') {
    // Beside the mic, clear of its ring and of the pill over it.
    return micTarget(scene.mic, {
      avoid: scene.controls,
      prefer: present([scene.merc === null ? null : mercBody(scene.merc)]),
    })
  }
  const arch = scene.arch
  if (arch === null) return null
  const foot = arch.apexX - arch.halfWidth
  const end = arch.apexX + arch.halfWidth
  const whole = glassBand(scene, arch, foot, end)
  switch (target) {
    case 'sung':
      return glassTarget(
        scene,
        glassBand(scene, arch, foot, scene.playheadX),
        whole,
      )
    case 'playhead': {
      const unit = scene.room.w
      return glassTarget(
        scene,
        glassBand(
          scene,
          arch,
          scene.playheadX - PLAYHEAD_BEHIND_W * unit,
          scene.playheadX + PLAYHEAD_AHEAD_W * unit,
        ),
        whole,
      )
    }
    case 'top': {
      const reach = TOP_REACH * arch.halfWidth
      return glassTarget(
        scene,
        glassBand(scene, arch, arch.apexX - reach, arch.apexX + reach),
        whole,
      )
    }
    case 'arch':
      return glassTarget(scene, whole, null)
  }
}

/** The first arch's glass as the scroll has it now, px from the layer. */
function archMark(root: Element, origin: Point, unit: number): ArchMark | null {
  const holder = root.querySelector('[data-testid="ng-glass"] [data-arch="0"]')
  if (holder === null) return null
  const r = holder.getBoundingClientRect()
  if (r.width === 0 || unit <= 0) return null
  const frame = PLATES['glass-unlit'].frame
  // The plate is placed from the apex: its left is `frame.left` W from it,
  // its top is the storyboard y `frame.top`.
  const apexX = r.left - origin.x - frame.left * unit
  const plateTop = r.top - origin.y
  const apexY = ARCH.deckY - ARCH.h
  return {
    apexX,
    halfWidth: ARCH.a * unit,
    top: plateTop + (apexY - frame.top) * unit,
    deck: plateTop + (ARCH.deckY - frame.top) * unit,
  }
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureNgScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  const unit = rects.room.w
  return {
    room: roomInside(rects),
    arch: archMark(rects.root, rects.origin, unit),
    playheadX: PLAYHEAD_X * unit,
    merc: id('ng-merc'),
    chip: id('ng-chip'),
    mic: id('ng-mic'),
    controls: present([
      id('ng-demo-skip'),
      id('ng-ask'),
      id('ng-demo-take'),
      id('ng-demo-progress'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimNgTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  return aimIn(measureNgScene(layer), (scene) => tipTarget(target, scene))
}
