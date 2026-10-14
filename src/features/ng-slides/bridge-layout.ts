// ============================================================
// The bridge's frame: storyboard W units to the room's pixels
// ============================================================
//
// The world keeps its size and place in W units (the room's width); the
// storyboard frame (aspect 2.578) is taller than any phone, and its extra
// height is cropped equally from the sky and the water (ng-geometry.json,
// frame.rule). On a short phone (375 x 667, 360 x 640) that would put the
// first arch's top note and Merc's head under the chip, so the world comes
// down until both clear it; and if Merc standing on the deck would then
// reach the mic, he is drawn smaller. Nothing here is a guess at the phone:
// the room measures the chip's bottom and the controls' top and hands
// them in.

import { MERC_FEET } from '@/components/room-kit/MercView'
import { ARCH, NOTE_NAMES, STORYBOARD_ASPECT } from './bridge-geometry'

/** Merc's canvas on the bridge, square, W (his body is about half of it). */
export const MERC_SIZE_W = 0.36
/** Merc at the result (screen 4): small, at the bridge's far end. */
export const MERC_RESULT = { x: 0.89, feetH: 0.535, sizeW: 0.2 } as const
/** Px kept between the chip and what is drawn under it. */
const CLEAR_PX = 4
/** The note names' half height over their centre, W (cap height and ascent). */
const LABEL_HALF_W = 0.032

export interface BridgeBox {
  readonly width: number
  readonly height: number
  /** The chip's bottom edge, px from the box's top. */
  readonly chipBottom: number
  /** The controls' top edge (the mic), px from the box's top. */
  readonly controlsTop: number
}

export interface BridgeLayout {
  readonly width: number
  readonly height: number
  /** Px per W. */
  readonly unit: number
  /** The storyboard y at the box's top edge, W: the take's frame. */
  readonly top: number
  /** The same for the result's picture: the plain frame rule. */
  readonly resultTop: number
  /** Merc's canvas, px. */
  readonly mercSize: number
  readonly chipBottom: number
  readonly controlsTop: number
}

/** The frame rule's crop: storyboard y of the top edge for aspect `a`. */
export function cropTop(aspect: number): number {
  return (STORYBOARD_ASPECT - aspect) / 2
}

export function layoutBridge(box: BridgeBox): BridgeLayout {
  const unit = box.width
  const plain = cropTop(box.height / box.width)
  const mercSize = MERC_SIZE_W * unit
  // At the top of a slide Merc's feet are on the apex; the top note's name
  // sits over it. Both stay under the chip.
  const apexPx = (ARCH.apexY - plain) * unit
  const mercTop = apexPx - mercSize * MERC_FEET
  const labelTop =
    (ARCH.apexY + NOTE_NAMES.top.dy - LABEL_HALF_W - plain) * unit
  const short = box.chipBottom + CLEAR_PX - Math.min(mercTop, labelTop)
  const top = short > 0 ? plain - short / unit : plain
  // On the deck his canvas must not reach the controls.
  const deckPx = (ARCH.deckY - top) * unit
  const room = box.controlsTop - CLEAR_PX - deckPx
  const size = Math.max(0.2 * unit, Math.min(mercSize, room / (1 - MERC_FEET)))
  return {
    width: box.width,
    height: box.height,
    unit,
    top,
    resultTop: plain,
    mercSize: size,
    chipBottom: box.chipBottom,
    controlsTop: box.controlsTop,
  }
}

/** Storyboard y (W) to px from the box's top, in the take's frame. */
export function yOf(layout: BridgeLayout, y: number): number {
  return (y - layout.top) * layout.unit
}

/**
 * The arch's shape (ng-geometry arch.function): 1 on the flat top (|u| up
 * to f), easing down to 0 at the feet (|u| = 1), u = (X - X_k) / a.
 */
export function archG(u: number, f: number): number {
  const x = Math.abs(u)
  if (x <= f) return 1
  if (x >= 1) return 0
  const s = (x - f) / (1 - f)
  return 1 - s * s * (3 - 2 * s)
}

/** A pitch on arch `root`'s scale to storyboard y (ng-geometry pitch_to_y). */
export function pitchY(midi: number, root: number): number {
  return ARCH.deckY - (ARCH.h * (midi - root)) / 7
}

export interface MercBox {
  readonly left: number
  readonly top: number
  readonly size: number
}

/**
 * Merc's canvas with his feet at (x W, feet y storyboard W), kept under
 * the chip however sharp the voice.
 */
export function mercBoxAt(
  layout: BridgeLayout,
  x: number,
  feetY: number,
): MercBox {
  const size = layout.mercSize
  const top = Math.max(
    layout.chipBottom + CLEAR_PX,
    yOf(layout, feetY) - size * MERC_FEET,
  )
  return { left: x * layout.unit - size / 2, top, size }
}

/** Merc at the result: small, at the far end of the pulled-back bridge. */
export function mercResultBox(layout: BridgeLayout): MercBox {
  const size = MERC_RESULT.sizeW * layout.unit
  const feet =
    (MERC_RESULT.feetH * STORYBOARD_ASPECT - layout.resultTop) * layout.unit
  return {
    left: MERC_RESULT.x * layout.unit - size / 2,
    top: feet - size * MERC_FEET,
    size,
  }
}
