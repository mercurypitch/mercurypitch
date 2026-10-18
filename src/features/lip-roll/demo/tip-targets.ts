// ============================================================
// What each demo tooltip points at, in the Lip roll room as drawn now
// ============================================================
//
// The first wave is measured off the screen where the camera has it now
// (BayScene's `[data-wave="0"]` holder, which moves and zooms with the
// waves), and its crest and root are read from the plate's frame in W
// (bay-geometry.ts, WAVE and PLATES). The voice is where Merc is: his
// canvas's middle, the playhead on a run, further right once the demo's
// camera stands (bay-scroll.ts holdCamera). Merc, his line, the chip, the
// mic and the demo's own controls are measured as they stand. The demo
// kit's layer (demo-kit/DemoLayer.tsx) asks `aimLipTip` where each tooltip
// goes.
//
// A tooltip is placed once, when it shows, and Merc rides on under it, so
// it keeps clear of where he will be while it is up (`lane`: his boxes
// over the time ahead, from the controller's mercAhead), not only of
// where he is. No tooltip covers the room's controls (Skip, "?", the
// take's pill, the progress bar, the mic and its ring), Merc's body, his
// line, the chip, or the water it explains. What every room's tooltips
// share (the room measured off the layer, the gaps, the mic's target, a
// lit stretch of the world) is the demo kit's (demo-kit/tip-target.ts).

import type { Point, Rect } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, controlsClear, micTarget, partOf, present, roomInside, roomRects, stretchOf, stretchTarget, } from '@/components/demo-kit/tip-target'
import { PLATES, WAVE } from '../bay-geometry'
import type { DemoTarget } from './demo-cues'

/** The first wave on screen: its crest and root, px. */
export interface WaveMark {
  /** The crest's x, px from the room's left. */
  readonly crestX: number
  /** Half the wave's span, px. */
  readonly halfWidth: number
  /** The crest's line (the top of the water) and the root's, px. */
  readonly top: number
  readonly root: number
}

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly wave: WaveMark | null
  /** Merc's canvas: where the voice is now, and what he covers. */
  readonly merc: Rect | null
  /** His canvas over the time ahead, while the tooltip will be up. */
  readonly lane: readonly Rect[]
  readonly bubble: Rect | null
  readonly chip: Rect | null
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** The water lit behind the voice and a little ahead of it, W. */
const VOICE_BEHIND_W = 0.12
const VOICE_AHEAD_W = 0.02
/** The top: the flat top and a little either side, of a. */
const TOP_REACH = WAVE.f + 0.12
/**
 * Merc's drawn body and his buzz in his canvas, as the room's own drive
 * measured them (0.06 to 0.87 of its width, 0.19 to 0.90 of its height).
 */
const BODY = { x0: 0.06, x1: 0.87, y0: 0.19, y1: 0.9 } as const
/** The same, as a part of his canvas. */
const BODY_PART: Rect = {
  x: BODY.x0,
  y: BODY.y0,
  w: BODY.x1 - BODY.x0,
  h: BODY.y1 - BODY.y0,
}

/** Merc's body inside his canvas, which is mostly clear over his head. */
export function mercBody(canvas: Rect): Rect {
  return partOf(canvas, BODY_PART)
}

/** The water from x0 to x1 (px), crest line to root, kept on the screen. */
function waterBand(
  scene: DemoScene,
  wave: WaveMark,
  x0: number,
  x1: number,
): Rect | null {
  return stretchOf(scene.room, x0, x1, wave.top, wave.root)
}

/**
 * What no tooltip covers: the room's controls and the demo's own (with a
 * gap), the mic's ring, the chip, Merc's line, and Merc now and while the
 * tooltip is up.
 */
function keepClear(scene: DemoScene): Rect[] {
  return [
    ...controlsClear(scene.controls, scene.mic),
    ...present([
      scene.chip,
      scene.bubble,
      scene.merc === null ? null : mercBody(scene.merc),
    ]),
    ...scene.lane.map(mercBody),
  ]
}

/**
 * A stretch of the wave: above it in the sky or under it over the sea,
 * covering none of it, and as little of the rest of the wave as it can.
 */
function waterTarget(
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
  const wave = scene.wave
  if (wave === null) return null
  const foot = wave.crestX - wave.halfWidth
  const end = wave.crestX + wave.halfWidth
  const whole = waterBand(scene, wave, foot, end)
  switch (target) {
    case 'voice': {
      const merc = scene.merc
      if (merc === null) return null
      const voice = merc.x + merc.w / 2
      const unit = scene.room.w
      return waterTarget(
        scene,
        waterBand(
          scene,
          wave,
          voice - VOICE_BEHIND_W * unit,
          voice + VOICE_AHEAD_W * unit,
        ),
        whole,
      )
    }
    case 'top': {
      const reach = TOP_REACH * wave.halfWidth
      return waterTarget(
        scene,
        waterBand(scene, wave, wave.crestX - reach, wave.crestX + reach),
        whole,
      )
    }
    case 'wave':
      return waterTarget(scene, whole, null)
  }
}

/** The first wave as the camera has it now, px from the layer. */
function waveMark(root: Element, origin: Point): WaveMark | null {
  const holder = root.querySelector('[data-testid="lip-waves"] [data-wave="0"]')
  if (holder === null) return null
  const r = holder.getBoundingClientRect()
  const frame = PLATES['wave-unlit'].frame
  if (r.width === 0 || r.height === 0) return null
  // The plate is placed about the crest, and zoomed with the world: its
  // left is `frame.left` W from the crest, its top `frame.top` W over it.
  const unitX = r.width / frame.width
  const unitY = r.height / frame.height
  const top = r.top - origin.y - frame.top * unitY
  return {
    crestX: r.left - origin.x - frame.left * unitX,
    halfWidth: WAVE.a * unitX,
    top,
    root: top + WAVE.h * unitY,
  }
}

/**
 * The room's parts, measured from the layer (which covers the room), and
 * Merc's canvas over the time ahead (`lane`, px from the layer).
 */
export function measureLipScene(
  layer: HTMLElement,
  lane: readonly Rect[] = [],
): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  return {
    room: roomInside(rects),
    wave: waveMark(rects.root, rects.origin),
    merc: id('lip-merc'),
    lane,
    bubble: id('lip-bubble'),
    chip: id('lip-chip'),
    mic: id('lip-mic'),
    controls: present([
      id('lip-demo-skip'),
      id('lip-ask'),
      id('lip-demo-take'),
      id('lip-demo-progress'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimLipTip(
  target: DemoTarget,
  layer: HTMLElement,
  lane: readonly Rect[] = [],
): TipAim | null {
  return aimIn(measureLipScene(layer, lane), (scene) =>
    tipTarget(target, scene),
  )
}
