// ============================================================
// The bay's frame: storyboard W units to the room's pixels
// ============================================================
//
// The world keeps its size and place in W units (the room's width). The
// storyboard frame (aspect 2.6206) is taller than any phone, and on Lip
// roll the frame is top-anchored (L0 5.3): the storyboard's top row sits
// at the window's top and all the extra height is cut from the near sea
// under the controls, because an equal crop (Ng's rule) puts Merc,
// riding sharp at a crest, into the chip. If Merc riding sharp would still
// reach the chip, the world comes further down; if, flat at the root, he
// would then reach the controls (a short phone, 375 x 667), the world is
// drawn smaller, about the playhead's column, until both clear.
//
// The waves are painted at wave B's size (screens 2 and 3). The intro's
// camera shows them at wave A's (screen 1): `zoomAt(0)` squeezes the
// world to it, `zoomAt(1)` is the run's, and the count-in moves between
// the two (bay-scroll.ts). Nothing here is a guess at the phone: the room
// measures the chip's bottom and the controls' top and hands them in.

import { MERC_FEET } from '@/components/room-kit/MercView'
import { CORE } from '@/components/room-kit/ribbon'
import type { GlidePath } from '@/lib/glide/glide-path'
import { targetAt } from '@/lib/glide/glide-path'
import { BAY, INTRO, PLAYHEAD_X, RESULT_ASPECT, WAVE } from './bay-geometry'
import { crestX } from './bay-scroll'

/** Merc's canvas in the bay, square, W (his body is about 0.30 W wide in it). */
export const MERC_SIZE_W = 0.48
/** Merc's centre at the intro: screen 1's place (body 0.035 to 0.357 W). */
export const MERC_INTRO_X = 0.196
/**
 * Merc at the result (screen 4): body 0.094 to 0.484 W, feet at 0.706 H of
 * its frame, so a canvas 0.56 W wide.
 */
export const MERC_RESULT = { x: 0.289, feetY: 1.8548, sizeW: 0.56 } as const
/** How far over the crest and under the root the voice takes him, W. */
export const ABOVE_CREST_W = 0.12
export const UNDER_ROOT_W = 0.08
/** The voice's ribbon: the shared look at 390 px, a little wider, as on the bridge. */
export const RIBBON_REFERENCE_W = 390
export const RIBBON_WIDEN = 1.15
/** Half the ribbon's core across, W (4.9 px on a 390 px phone). */
export const RIBBON_HALF_W =
  (CORE[0].width * RIBBON_WIDEN) / 2 / RIBBON_REFERENCE_W
/**
 * How far his toes reach under MERC_FEET while he rides, W: 2.6 px on a
 * 390 px phone (measured on a held note, 16 Oct).
 */
const RIDE_TOES_W = 0.0067
/**
 * His feet this far under the voice's line, W: negative, so they rest on
 * the ribbon's top edge and the whole line shows under him. On the path he
 * stands on the dots; flat, the dots cross him; sharp, he stands clear
 * over them. Screens 2 and 3 sink him 0.14 to 0.18 W into the wave, the
 * line across his middle; the owner asked for it under his feet (16 Oct).
 */
export const MERC_SINK_W = -(RIBBON_HALF_W + RIDE_TOES_W)
/** Px kept between the chip or the controls and what is drawn near them. */
const CLEAR_PX = 4

/** Storyboard y of the highest and lowest things a run draws (his canvas). */
const TOP_EXTENT =
  WAVE.crestY - ABOVE_CREST_W + MERC_SINK_W - MERC_SIZE_W * MERC_FEET
const BOTTOM_EXTENT =
  WAVE.rootY + UNDER_ROOT_W + MERC_SINK_W + MERC_SIZE_W * (1 - MERC_FEET)

export interface BayBox {
  readonly width: number
  readonly height: number
  /** The chip's bottom edge, px from the box's top. */
  readonly chipBottom: number
  /** The controls' top edge (the mic), px from the box's top. */
  readonly controlsTop: number
}

export interface BayLayout {
  readonly width: number
  readonly height: number
  /** Px per W of the world: the width, or less on a short phone. */
  readonly unit: number
  /** The world's scale, unit over width (1 but on a short phone). */
  readonly scale: number
  /** The storyboard y at the box's top edge, W. */
  readonly top: number
  /** The same for the result's picture (screen 4): the equal crop. */
  readonly resultTop: number
  /** Merc's canvas, px. */
  readonly mercSize: number
  readonly chipBottom: number
  readonly controlsTop: number
}

/** The equal crop's top edge for a frame of aspect `frame` on aspect `a`. */
export function cropTop(frame: number, aspect: number): number {
  return (frame - aspect) / 2
}

export function layoutBay(box: BayBox): BayLayout {
  const width = box.width
  const chip = box.chipBottom + CLEAR_PX
  const controls = box.controlsTop - CLEAR_PX
  let unit = width
  // Top-anchored, lowered further only if Merc sharp at a crest needs it.
  let top = Math.min(0, TOP_EXTENT - chip / unit)
  if ((BOTTOM_EXTENT - top) * unit > controls) {
    // Too short: drawn smaller, still top-anchored while the chip allows.
    unit = controls / BOTTOM_EXTENT
    top = 0
    if (TOP_EXTENT * unit < chip) {
      unit = (controls - chip) / (BOTTOM_EXTENT - TOP_EXTENT)
      top = TOP_EXTENT - chip / unit
    }
    unit = Math.min(width, unit)
  }
  return {
    width,
    height: box.height,
    unit,
    scale: unit / width,
    top,
    resultTop: cropTop(RESULT_ASPECT, box.height / width),
    mercSize: MERC_SIZE_W * unit,
    chipBottom: box.chipBottom,
    controlsTop: box.controlsTop,
  }
}

/** The camera's zoom: how the world's W maps to the screen's. */
export interface Zoom {
  /** Across, and up and down, against the run's (wave B's) size. */
  readonly sx: number
  readonly sy: number
  /** Storyboard y where the wave's crest line is drawn. */
  readonly crestY: number
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** The intro's camera at 0 (screen 1, wave A), the run's at 1 (wave B). */
export function zoomAt(z: number): Zoom {
  const k = Math.max(0, Math.min(1, z))
  return {
    sx: lerp(INTRO.sx, 1, k),
    sy: lerp(INTRO.sy, 1, k),
    crestY: lerp(INTRO.crestY, WAVE.crestY, k),
  }
}

/** The bay-back's horizon at a zoom: screen 1's, then screens 2 and 3's. */
export function horizonAt(z: number): number {
  return lerp(BAY.horizon, BAY.horizonRun, Math.max(0, Math.min(1, z)))
}

/** A world y (wave B's frame) to storyboard y under `zoom`. */
export function frameY(zoom: Zoom, worldY: number): number {
  return zoom.crestY + zoom.sy * (worldY - WAVE.crestY)
}

/** Storyboard y (W) to px from the box's top. */
export function yOf(layout: BayLayout, y: number): number {
  return (y - layout.top) * layout.unit
}

/** A screen x (W, as the storyboard places it) to px: about the playhead. */
export function xOf(layout: BayLayout, x: number): number {
  return PLAYHEAD_X * layout.width + (x - PLAYHEAD_X) * layout.unit
}

/** A world X to px, the camera at `camera`. */
export function worldXOf(
  layout: BayLayout,
  zoom: Zoom,
  camera: number,
  x: number,
): number {
  return PLAYHEAD_X * layout.width + zoom.sx * (x - camera) * layout.unit
}

/**
 * The wave's shape (lip-geometry: wave model): 1 on the flat top (|u| up
 * to f), easing down to 0 at the feet (|u| = 1), u = (X - X_k) / a.
 */
export function waveG(u: number, f: number): number {
  const x = Math.abs(u)
  if (x <= f) return 1
  if (x >= 1) return 0
  const s = (x - f) / (1 - f)
  return 1 - s * s * (3 - 2 * s)
}

/**
 * A pitch on wave `root`'s scale to world y: the root on the root line,
 * the wave's top note on the crest line, whatever its height in semitones
 * (an octave, or less for a narrow voice), so the path is always the
 * painted wave's crest.
 */
export function pitchY(midi: number, root: number, semitones: number): number {
  return WAVE.rootY - (WAVE.h * (midi - root)) / Math.max(1, semitones)
}

/** The dots' SVG runs this far past the first and last waves, W. */
export const DOTS_MARGIN = 1.6

/** Wave k's crest line as the path draws it, in world X and world y. */
export function crestLine(path: GlidePath, k: number): [number, number][] {
  const wave = path.arches[k] as (typeof path.arches)[number] | undefined
  if (wave === undefined) return []
  const steps = 96
  const semitones = wave.topMidi - wave.rootMidi
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = wave.start + ((wave.end - wave.start) * i) / steps
    const midi = targetAt(path, t) ?? wave.rootMidi
    out.push([
      crestX(k) - WAVE.a + (2 * WAVE.a * i) / steps,
      pitchY(midi, wave.rootMidi, semitones),
    ])
  }
  return out
}

/** Where the dots' layer puts world X under a zoom, before its translate. */
export const localX = (layout: BayLayout, zoom: Zoom, x: number): number =>
  (zoom.sx * x + DOTS_MARGIN) * layout.unit

export interface MercBox {
  readonly left: number
  readonly top: number
  readonly size: number
}

/**
 * Merc's canvas riding world y `feetY` (the voice's line; his feet rest
 * on it, MERC_SINK_W) at screen x `x` (W) under `zoom`, kept under the
 * chip however sharp the voice.
 */
export function mercBoxAt(
  layout: BayLayout,
  zoom: Zoom,
  x: number,
  feetY: number,
): MercBox {
  const size = layout.mercSize
  const top = Math.max(
    layout.chipBottom + CLEAR_PX,
    yOf(layout, frameY(zoom, feetY)) +
      MERC_SINK_W * layout.unit -
      size * MERC_FEET,
  )
  return { left: xOf(layout, x) - size / 2, top, size }
}

/**
 * Merc at the result: screen 4's place in the equal crop, drawn smaller
 * if he would reach the buttons.
 */
export function mercResultBox(layout: BayLayout): MercBox {
  const feet = (MERC_RESULT.feetY - layout.resultTop) * layout.width
  const room = (layout.controlsTop - CLEAR_PX - feet) / (1 - MERC_FEET)
  const size = Math.max(
    0.3 * layout.width,
    Math.min(MERC_RESULT.sizeW * layout.width, room),
  )
  return {
    left: MERC_RESULT.x * layout.width - size / 2,
    top: feet - size * MERC_FEET,
    size,
  }
}
