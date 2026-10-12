// ============================================================
// What a demo tooltip points at, measured off the room as it is drawn now
// ============================================================
//
// A room turns its own parts into a target for each tooltip: where the
// arrow may touch, what it must never cover, what it had better not cover,
// and the soft glow on what it explains. The parts are measured when the
// tooltip shows, from the demo layer, which covers the whole room
// (DemoLayer.tsx), so every anchor follows the room's real layout.

import type { Point, Rect, Side } from './tip-place'

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
  /** The part with this test id; null when it is not shown. */
  byTestId: (testId: string) => Rect | null
}

/** The room under the demo layer, measured from the layer; null with none. */
export function roomRects(layer: HTMLElement): RoomRects | null {
  const root = layer.parentElement
  if (root === null) return null
  const origin = layer.getBoundingClientRect()
  return {
    room: { x: 0, y: 0, w: origin.width, h: origin.height },
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
