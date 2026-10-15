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
// line, the chip, or the water it explains.

import type { Point, Rect, Side } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { roomRects } from '@/components/demo-kit/tip-target'
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

/** The arrow keeps this far off what it points at. */
const ARROW_GAP = 4
/** The mic's pulse ring reaches this far past the disc. */
const MIC_RING = 14
/** A tooltip keeps this far from the demo's own controls. */
const CONTROL_GAP = 8
/** The water lit behind the voice and a little ahead of it, W. */
const VOICE_BEHIND_W = 0.12
const VOICE_AHEAD_W = 0.02
/** The top: the flat top and a little either side, of a. */
const TOP_REACH = WAVE.f + 0.12
/** The water glows this far past the crest line. */
const WATER_GLOW = 6
/**
 * Merc's drawn body and his buzz in his canvas, as the room's own drive
 * measured them (0.06 to 0.87 of its width, 0.19 to 0.90 of its height).
 */
const BODY = { x0: 0.06, x1: 0.87, y0: 0.19, y1: 0.9 } as const

const present = (rects: readonly (Rect | null)[]): Rect[] =>
  rects.filter((rect): rect is Rect => rect !== null)

/** Merc's body inside his canvas, which is mostly clear over his head. */
export function mercBody(canvas: Rect): Rect {
  return {
    x: canvas.x + canvas.w * BODY.x0,
    y: canvas.y + canvas.h * BODY.y0,
    w: canvas.w * (BODY.x1 - BODY.x0),
    h: canvas.h * (BODY.y1 - BODY.y0),
  }
}

/** The water from x0 to x1 (px), crest line to root, kept on the screen. */
function waterBand(
  scene: DemoScene,
  wave: WaveMark,
  x0: number,
  x1: number,
): Rect | null {
  const left = Math.max(scene.room.x, x0)
  const right = Math.min(scene.room.x + scene.room.w, x1)
  if (right - left < 4) return null
  return { x: left, y: wave.top, w: right - left, h: wave.root - wave.top }
}

/**
 * What no tooltip covers: the room's controls and the demo's own (with a
 * gap), the mic's ring, the chip, Merc's line, and Merc now and while the
 * tooltip is up.
 */
function keepClear(scene: DemoScene): Rect[] {
  return present([
    ...scene.controls.map((rect) => inflate(rect, CONTROL_GAP)),
    scene.mic === null ? null : inflate(scene.mic, MIC_RING),
    scene.chip,
    scene.bubble,
    scene.merc === null ? null : mercBody(scene.merc),
    ...scene.lane.map(mercBody),
  ])
}

/** Around a box: the point on each side the arrow touches. */
function around(box: Rect, gap: number): Partial<Record<Side, Point>> {
  const midX = box.x + box.w / 2
  const midY = box.y + box.h / 2
  return {
    above: { x: midX, y: box.y - gap },
    below: { x: midX, y: box.y + box.h + gap },
    left: { x: box.x - gap, y: midY },
    right: { x: box.x + box.w + gap, y: midY },
  }
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
  if (band === null) return null
  return {
    anchors: around(band, ARROW_GAP),
    sides: ['above', 'below'],
    avoid: [band, ...keepClear(scene)],
    prefer: present([whole]),
    glow: { kind: 'light', rect: inflate(band, WATER_GLOW) },
  }
}

/** Beside the mic, clear of its ring and of the pill over it. */
function micTarget(scene: DemoScene): TipTarget | null {
  const mic = scene.mic
  if (mic === null) return null
  const ring = inflate(mic, MIC_RING)
  const midY = mic.y + mic.h / 2
  return {
    anchors: {
      above: { x: mic.x + mic.w / 2, y: ring.y },
      right: { x: ring.x + ring.w, y: midY },
      left: { x: ring.x, y: midY },
    },
    sides: ['above', 'right', 'left'],
    avoid: present([ring, ...scene.controls]),
    prefer: present([scene.merc === null ? null : mercBody(scene.merc)]),
    glow: null,
  }
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  if (target === 'mic') return micTarget(scene)
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
  const root = layer.parentElement
  if (rects === null || root === null) return null
  const box = layer.getBoundingClientRect()
  const origin = { x: box.left, y: box.top }
  const id = rects.byTestId
  // Drawn full-bleed, the room runs under the status bar and the floating
  // bar; its padding keeps its controls clear of them, and the tooltips.
  const style = window.getComputedStyle(root)
  const top = Number.parseFloat(style.paddingTop) || 0
  const bottom = Number.parseFloat(style.paddingBottom) || 0
  return {
    room: {
      ...rects.room,
      y: top,
      h: Math.max(0, rects.room.h - top - bottom),
    },
    wave: waveMark(root, origin),
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
  const scene = measureLipScene(layer, lane)
  const aim = scene === null ? null : tipTarget(target, scene)
  if (scene === null || aim === null) return null
  return { target: aim, bounds: scene.room }
}
