// ============================================================
// Sky layout: where Echo's plate, stars and Merc sit in a room of any shape
// ============================================================
//
// The world plate is drawn at the room's width and anchored to its bottom,
// as the storyboard frames it (ART-FIDELITY.md 3.4, reflow): the roof,
// Merc's ridge and the microphone keep their distance from the bottom edge
// in W units, and a room taller than the plate shows the sky colour above
// it. Every place comes from echo-geometry.ts in plate fractions and goes
// through the same transform, so a star never lands on the town.
//
// The storyboard's frame (390 x 844, full screen) fits everything at its
// own size. A shorter room (a 16:9 phone, or any phone inside the shell's
// bar and dock) is short of sky, so:
//
// 1. the plate slides down by up to SLIDE_MAX_W (the roof's bottom is
//    cropped; the microphone still sits on roof);
// 2. the sky's content (rings, stars, constellations) is drawn smaller by
//    k, at most down to K_MIN, gathered toward the open sky's floor, so it
//    keeps its height above the town;
// 3. where even that does not fit (a tablet, until its own plate lands in
//    PR 5), the composition narrows to a centred column, and the plate's
//    band colours continue the world to either side.
//
// Pure: the room measures its box and asks here.

import type { PlatePoint } from './echo-geometry'
import { OPEN_SKY_FLOOR, PLATE_BASE, PLATE_ROWS, RESULT_SLOTS, } from './echo-geometry'

/** How far the plate may slide down on a short room, in W. */
export const SLIDE_MAX_W = 0.1
/** The smallest the sky's content is drawn on a short room. */
export const K_MIN = 0.75

/** The base frame's height over its width (the storyboard's 19.5:9). */
const BASE_ASPECT = PLATE_BASE.height / PLATE_BASE.width
/** The shipped plate's height over its width (the base frame and the sky). */
const PLATE_ASPECT = PLATE_ROWS / PLATE_BASE.width

/**
 * The open sky's floor where the content gathers: its median across the
 * middle of the plate, where the phrase's stars sit.
 */
export const FLOOR_V = median(
  OPEN_SKY_FLOOR.filter(([u]) => u >= 0.06 && u <= 0.94).map(([, v]) => v),
)

/** The top of the content above the floor, in plate v at k = 1. */
export const CONTENT_TOP_V = {
  /** Screen 2's top-left constellation, the highest thing in the sky. */
  finished: 0.165,
  /**
   * The middle finished slots' stars' tops (FINISHED_SLOTS 3 and 4, less
   * half a finished star): the chip sits right over them, so they keep under
   * its row as the phrase does.
   */
  middle: 0.189,
  /** The phrase's highest star's top (an octave above its lowest note). */
  phrase: 0.245,
  /** Screen 4's top constellations' tops. */
  result: 0.27,
} as const

export interface SkyBox {
  /** The room's box, CSS px. */
  readonly width: number
  readonly height: number
  /** Nothing of the sky's content above this (px from the box's top). */
  readonly edgeClear: number
  /** The phrase's stars and the middle slots stay under this: the chip row's bottom. */
  readonly chipClear: number
  /** The result's constellations stay under this: the result's numbers. */
  readonly resultClear: number
}

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

export interface SkyLayout {
  readonly width: number
  readonly height: number
  /** The composition's column: the whole width but on a tablet. */
  readonly column: { readonly left: number; readonly width: number }
  /** The plate image's box, px (its top may be above the room's). */
  readonly plate: {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
  /** How far the plate slid down, px. */
  readonly slide: number
  /** The take's content scale, and the result's. */
  readonly k: number
  readonly kResult: number
  /** The floor the content gathers toward, px from the box's top. */
  readonly floorY: number
  /** px per W: the column's width. */
  readonly unit: number
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Fit {
  readonly slide: number
  readonly k: number
}

/**
 * One content's slide and scale: `room` is the height above the floor
 * down to `clear` at no slide, `need` the content's height above the floor
 * at k = 1, both px.
 */
function fit(room: number, need: number, slideMax: number): Fit {
  if (need <= room) return { slide: 0, k: 1 }
  if (need <= room + slideMax) return { slide: need - room, k: 1 }
  return { slide: slideMax, k: (room + slideMax) / need }
}

/** Plate v to px from the box's top, for a column `w` wide. */
const plateY = (v: number, height: number, w: number, slide: number) =>
  height - (1 - v) * BASE_ASPECT * w + slide

/** The take's and the result's fits for a column `w` wide. */
function fitsFor(box: SkyBox, w: number): { take: Fit; result: Fit } {
  const floor0 = plateY(FLOOR_V, box.height, w, 0)
  const need = (topV: number) => (FLOOR_V - topV) * BASE_ASPECT * w
  const slideMax = SLIDE_MAX_W * w
  const take = [
    fit(floor0 - box.edgeClear, need(CONTENT_TOP_V.finished), slideMax),
    fit(floor0 - box.chipClear, need(CONTENT_TOP_V.middle), slideMax),
    fit(floor0 - box.chipClear, need(CONTENT_TOP_V.phrase), slideMax),
  ].reduce((a, b) => (b.k < a.k || (b.k === a.k && b.slide > a.slide) ? b : a))
  // The result moves the constellations, not the plate: it keeps the take's
  // slide, so the town stays where it was.
  const resultRoom = floor0 + take.slide - box.resultClear
  const resultNeed = need(CONTENT_TOP_V.result)
  const result = { slide: take.slide, k: Math.min(1, resultRoom / resultNeed) }
  return { take, result }
}

/** The widest column whose take fits at K_MIN; the box's width when it fits. */
function columnWidth(box: SkyBox): number {
  if (fitsFor(box, box.width).take.k >= K_MIN) return box.width
  let lo = 0
  let hi = box.width
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (fitsFor(box, mid).take.k >= K_MIN) lo = mid
    else hi = mid
  }
  return Math.floor(lo)
}

/** The plate, the column and the content scales for a room's box. */
export function layoutSky(box: SkyBox): SkyLayout {
  const w = columnWidth(box)
  const { take, result } = fitsFor(box, w)
  const left = (box.width - w) / 2
  const plateHeight = PLATE_ASPECT * w
  return {
    width: box.width,
    height: box.height,
    column: { left, width: w },
    plate: {
      left,
      top: box.height + take.slide - plateHeight,
      width: w,
      height: plateHeight,
    },
    slide: take.slide,
    k: Math.max(K_MIN, take.k),
    kResult: Math.max(K_MIN * 0.8, Math.min(1, result.k)),
    floorY: plateY(FLOOR_V, box.height, w, take.slide),
    unit: w,
  }
}

/** A place on the plate itself (Merc's seat, the ridge, a twinkle), px. */
export function onPlate(layout: SkyLayout, p: PlatePoint): ScreenPoint {
  return {
    x: layout.column.left + p.u * layout.unit,
    y: plateY(p.v, layout.height, layout.unit, layout.slide),
  }
}

/**
 * A place in the sky's content at scale `k`: the plate's place, gathered
 * toward the floor under the column's middle.
 */
export function inSky(
  layout: SkyLayout,
  p: PlatePoint,
  k: number,
): ScreenPoint {
  const at = onPlate(layout, p)
  const midX = layout.column.left + layout.unit / 2
  return {
    x: midX + (at.x - midX) * k,
    y: layout.floorY - (layout.floorY - at.y) * k,
  }
}

// ---- The phrase ------------------------------------------------------------

/** The first and last notes' columns, plate u. */
export const PHRASE_U = [0.17, 0.83] as const
/** The phrase's middle pitch sits at this plate v. */
export const PHRASE_MID_V = 0.35
/** One semitone's height, W. */
export const SEMITONE_W = 0.022
/** A phrase star's width at most, as a share of the gap between columns. */
const STAR_GAP_SHARE = 0.9

/** Plate v per W: a height in W as a step in v. */
const V_PER_W = 1 / BASE_ASPECT

/** Each note's place in the sky at k = 1, plate fractions. */
export function phrasePlaces(midis: readonly number[]): PlatePoint[] {
  if (midis.length === 0) return []
  const centre = (Math.min(...midis) + Math.max(...midis)) / 2
  const gap =
    midis.length > 1 ? (PHRASE_U[1] - PHRASE_U[0]) / (midis.length - 1) : 0
  return midis.map((midi, i) => ({
    u: midis.length > 1 ? PHRASE_U[0] + i * gap : 0.5,
    v: PHRASE_MID_V - (midi - centre) * SEMITONE_W * V_PER_W,
  }))
}

/**
 * A voice's height in the sky at k = 1, plate v, for a pitch (fractional
 * MIDI) against the phrase's notes: on the same scale as the stars, held
 * within half an octave past the phrase's ends.
 */
export function voiceV(midi: number, midis: readonly number[]): number {
  const low = Math.min(...midis)
  const high = Math.max(...midis)
  const centre = (low + high) / 2
  const held = Math.max(low - 6, Math.min(high + 6, midi))
  return PHRASE_MID_V - (held - centre) * SEMITONE_W * V_PER_W
}

/** A phrase star's width in W: the storyboard's, or less where the notes crowd. */
export function phraseStarW(notes: number, storyboardW: number): number {
  if (notes < 2) return storyboardW
  const gap = (PHRASE_U[1] - PHRASE_U[0]) / (notes - 1)
  return Math.min(storyboardW, gap * STAR_GAP_SHARE)
}

// ---- Finished constellations ---------------------------------------------

export interface SlotBox {
  readonly u0: number
  readonly u1: number
  readonly v0: number
  readonly v1: number
}

/**
 * Where each finished phrase waits during the run, in the top band: screen
 * 2's two (top left, top right), beside the chip, then two more nearer the
 * middle, under it (CONTENT_TOP_V.middle keeps them there). The fifth phrase
 * never waits: the result takes all five.
 */
export const FINISHED_SLOTS: readonly SlotBox[] = [
  { u0: 0.065, u1: 0.215, v0: 0.172, v1: 0.234 },
  { u0: 0.76, u1: 0.925, v0: 0.205, v1: 0.272 },
  { u0: 0.27, u1: 0.4, v0: 0.2, v1: 0.245 },
  { u0: 0.6, u1: 0.73, v0: 0.2, v1: 0.245 },
]

/**
 * How far the fourth result place sits right of and above screen 4's: u,
 * and v up. Screen 4 fills that place with a shape that falls to the right,
 * along the roofs, but a phrase that rises would put its first star into
 * them: the open sky's floor climbs to v 0.45 at the left edge, above the
 * place's bottom. Moved this far, any shape clears the floor.
 */
export const RESULT_FOURTH_SHIFT = { u: 0.03, v: 0.03 } as const

/** Screen 4's five places, for the result, the fourth moved clear of the roofs. */
export const RESULT_BOXES: readonly SlotBox[] = RESULT_SLOTS.map((slot, i) =>
  i === 3
    ? {
        u0: slot.u0 + RESULT_FOURTH_SHIFT.u,
        u1: slot.u1 + RESULT_FOURTH_SHIFT.u,
        v0: slot.v0 - RESULT_FOURTH_SHIFT.v,
        v1: slot.v1 - RESULT_FOURTH_SHIFT.v,
      }
    : slot,
)

/**
 * A phrase's places fitted into a slot: the shape kept (one scale across
 * and down, in W), centred in the box.
 */
export function fitToSlot(
  places: readonly PlatePoint[],
  slot: SlotBox,
): PlatePoint[] {
  if (places.length === 0) return []
  const xs = places.map((p) => p.u)
  const ys = places.map((p) => p.v * BASE_ASPECT)
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  const boxX = slot.u1 - slot.u0
  const boxY = (slot.v1 - slot.v0) * BASE_ASPECT
  const scale = Math.min(
    spanX > 0 ? boxX / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? boxY / spanY : Number.POSITIVE_INFINITY,
  )
  const s = Number.isFinite(scale) ? scale : 0
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const midU = (slot.u0 + slot.u1) / 2
  const midY = ((slot.v0 + slot.v1) / 2) * BASE_ASPECT
  return places.map((_, i) => ({
    u: midU + (xs[i] - cx) * s,
    v: (midY + (ys[i] - cy) * s) / BASE_ASPECT,
  }))
}

/** The open sky's floor under a column, plate v (the town starts below it). */
export function floorAt(u: number): number {
  const first = OPEN_SKY_FLOOR[0]
  const last = OPEN_SKY_FLOOR[OPEN_SKY_FLOOR.length - 1]
  if (u <= first[0]) return first[1]
  if (u >= last[0]) return last[1]
  for (let i = 1; i < OPEN_SKY_FLOOR.length; i++) {
    const [u1, v1] = OPEN_SKY_FLOOR[i]
    if (u <= u1) {
      const [u0, v0] = OPEN_SKY_FLOOR[i - 1]
      return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0)
    }
  }
  return last[1]
}
