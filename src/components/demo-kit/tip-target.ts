// ============================================================
// What a demo tooltip points at, measured off the room as it is drawn now
// ============================================================
//
// A room turns its own parts into a target for each tooltip: where the
// arrow may touch, what it must never cover, what it had better not cover,
// and the soft glow on what it explains. The parts are measured when the
// tooltip shows, from the demo layer, which covers the whole room
// (DemoLayer.tsx), so every anchor follows the room's real layout.
//
// What every room's targets share is here: the room measured from the
// layer (`roomRects`, and `roomInside` for a room drawn full-bleed), the
// gaps a tooltip keeps, what no tooltip covers in any room (the demo's
// controls and the mic's ring, `controlsClear`), the mic's target, a
// stretch of a room's world lit by the voice (`stretchOf`,
// `stretchTarget`), Merc's body in his canvas, and the aim a room hands
// the layer (`aimIn`). What a room's tooltips point at, and what else they
// keep clear of, stays in the room's own demo/tip-targets.ts.

import type { Point, Rect, Side } from './tip-place'
import { inflate } from './tip-place'

export type GlowKind = 'line' | 'light' | 'text'

export interface TipTarget {
  readonly anchors: Partial<Record<Side, Point>>
  readonly sides: readonly Side[]
  readonly avoid: readonly Rect[]
  readonly prefer: readonly Rect[]
  /** The soft glow on what the tooltip explains; null for none. */
  readonly glow: { readonly kind: GlowKind; readonly rect: Rect } | null
}

/** A tooltip's target, and the room it must stay inside. */
export interface TipAim {
  readonly target: TipTarget
  readonly bounds: Rect
}

/** The room's parts, px from the room's top left. */
export interface RoomRects {
  /** The whole room. */
  readonly room: Rect
  /** The room's own element (the layer's parent), for what it reads off itself. */
  readonly root: HTMLElement
  /** The layer's top left on the screen, px: where a room's own reads start. */
  readonly origin: Point
  /** The part with this test id; null when it is not shown. */
  byTestId: (testId: string) => Rect | null
}

/** The arrow keeps this far off what it points at, px. */
export const ARROW_GAP = 4
/** The mic's pulse ring reaches this far past the disc, px. */
export const MIC_RING = 14
/** A tooltip keeps this far from the demo's own controls, px. */
export const CONTROL_GAP = 8
/** A stretch of the world glows this far past its edges, px. */
const STRETCH_GLOW = 6
/** Less of a stretch than this on the screen is none, px. */
const STRETCH_MIN = 4

/**
 * Merc's body in his canvas (MercView), which is mostly clear around him,
 * as fractions of the canvas. A room that draws him otherwise (Lip roll's
 * buzz, Long note's lantern) measures its own.
 */
export const MERC_BODY: Rect = { x: 0.26, y: 0.3, w: 0.48, h: 0.58 }

/** The room under the demo layer, measured from the layer; null with none. */
export function roomRects(layer: HTMLElement): RoomRects | null {
  const root = layer.parentElement
  if (root === null) return null
  const origin = layer.getBoundingClientRect()
  return {
    room: { x: 0, y: 0, w: origin.width, h: origin.height },
    root,
    origin: { x: origin.left, y: origin.top },
    byTestId: (testId) => {
      const el = root.querySelector(`[data-testid="${testId}"]`)
      if (el === null) return null
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return null
      return {
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
      }
    },
  }
}

/**
 * The room inside its padding, where a tooltip stays. Drawn full-bleed, a
 * room runs under the status bar and the floating bar; its padding keeps
 * its controls clear of them, and the tooltips.
 */
export function roomInside(rects: RoomRects): Rect {
  const style = window.getComputedStyle(rects.root)
  const top = Number.parseFloat(style.paddingTop) || 0
  const bottom = Number.parseFloat(style.paddingBottom) || 0
  return {
    ...rects.room,
    y: top,
    h: Math.max(0, rects.room.h - top - bottom),
  }
}

/** The parts that are shown, in order. */
export const present = (rects: readonly (Rect | null)[]): Rect[] =>
  rects.filter((rect): rect is Rect => rect !== null)

/** A part of a box: `part` is its place and size as fractions of the box. */
export function partOf(box: Rect, part: Rect): Rect {
  return {
    x: box.x + box.w * part.x,
    y: box.y + box.h * part.y,
    w: box.w * part.w,
    h: box.h * part.h,
  }
}

/** Merc's body inside his canvas, which is mostly clear around him. */
export function mercBody(canvas: Rect): Rect {
  return partOf(canvas, MERC_BODY)
}

/** Around a box: the point on each side the arrow touches. */
export function around(
  box: Rect,
  gap: number = ARROW_GAP,
): Partial<Record<Side, Point>> {
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
 * What no tooltip covers in any room: the demo's own controls and the
 * room's (with a gap), and the mic's ring. A room adds its own after them.
 */
export function controlsClear(
  controls: readonly Rect[],
  mic: Rect | null,
): Rect[] {
  return present([
    ...controls.map((rect) => inflate(rect, CONTROL_GAP)),
    mic === null ? null : inflate(mic, MIC_RING),
  ])
}

/** The mic's tooltip: over it, else beside it. */
const MIC_SIDES: readonly Side[] = ['above', 'right', 'left']

export interface MicTipOptions {
  /** The sides to try, best first; over the mic, else beside it. */
  readonly sides?: readonly Side[]
  /** Besides the ring: what is over or around the mic (the pill, a picker). */
  readonly avoid: readonly (Rect | null)[]
  /** What it had better not cover. */
  readonly prefer: readonly Rect[]
}

/** Beside the mic, clear of its ring and of what is over it. */
export function micTarget(
  mic: Rect | null,
  options: MicTipOptions,
): TipTarget | null {
  if (mic === null) return null
  const ring = inflate(mic, MIC_RING)
  const midY = mic.y + mic.h / 2
  return {
    anchors: {
      above: { x: mic.x + mic.w / 2, y: ring.y },
      right: { x: ring.x + ring.w, y: midY },
      left: { x: ring.x, y: midY },
    },
    sides: options.sides ?? MIC_SIDES,
    avoid: present([ring, ...options.avoid]),
    prefer: options.prefer,
    glow: null,
  }
}

/**
 * A stretch of a room's world, from x0 to x1 and from `top` to `bottom`
 * (px), cut to the room; null when too little of it is on the screen.
 */
export function stretchOf(
  room: Rect,
  x0: number,
  x1: number,
  top: number,
  bottom: number,
): Rect | null {
  const left = Math.max(room.x, x0)
  const right = Math.min(room.x + room.w, x1)
  if (right - left < STRETCH_MIN) return null
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/**
 * A stretch of the world the voice lights: above it or under it, covering
 * none of it nor `avoid`, and as little of the `whole` it is part of as it
 * can.
 */
export function stretchTarget(
  stretch: Rect | null,
  whole: Rect | null,
  avoid: readonly Rect[],
): TipTarget | null {
  if (stretch === null) return null
  return {
    anchors: around(stretch, ARROW_GAP),
    sides: ['above', 'below'],
    avoid: [stretch, ...avoid],
    prefer: present([whole]),
    glow: { kind: 'light', rect: inflate(stretch, STRETCH_GLOW) },
  }
}

/** Where a tooltip points in a measured room: its target, kept in its room; null hides it. */
export function aimIn<S extends { readonly room: Rect }>(
  scene: S | null,
  target: (scene: S) => TipTarget | null,
): TipAim | null {
  if (scene === null) return null
  const aim = target(scene)
  return aim === null ? null : { target: aim, bounds: scene.room }
}
