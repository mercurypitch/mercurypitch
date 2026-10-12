// ============================================================
// Where a demo tooltip goes: beside what it explains, covering nothing
// ============================================================
//
// Everything here is in px, measured off the screen at the moment a tooltip
// shows (DemoLayer.tsx): the element it explains, the room's controls, the
// room's picture (Long note's lantern). Nothing is derived from the room's
// layout constants, so the tooltips follow the picture wherever it is drawn.
//
// A tooltip sits on one side of its anchor, with its arrow touching the
// anchor. It may slide along that side while the arrow still reaches; of
// the places that cover nothing in `avoid`, the one covering least of
// `prefer` wins, nearer the middle and on an earlier side breaking ties.
// Past `maxHeight` (three lines) a tooltip reads as a column of words, so
// a place that wraps it shorter wins whenever one covers nothing.

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export type Side = 'above' | 'below' | 'left' | 'right'

export interface TipRequest {
  /** Where the arrow touches, for each side the tooltip may sit on. */
  readonly anchors: Partial<Record<Side, Point>>
  /** The sides to try, best first. */
  readonly sides: readonly Side[]
  /** The tooltip's size when it may be at most `maxWidth` wide. */
  readonly size: (maxWidth: number) => {
    readonly w: number
    readonly h: number
  }
  readonly bounds: Rect
  /** Never covered: what the tooltip explains, and the room's controls. */
  readonly avoid: readonly Rect[]
  /** Better not covered. */
  readonly prefer?: readonly Rect[]
  readonly maxWidth: number
  /** The tallest a tooltip should wrap to, px. */
  readonly maxHeight?: number
}

export interface TipPlace {
  readonly side: Side
  readonly box: Rect
  /** The arrow's offset along the box edge that faces the anchor. */
  readonly arrow: number
  /** The anchor the arrow touches. */
  readonly anchor: Point
  /** False only when no place covered nothing in `avoid`. */
  readonly clear: boolean
}

/** From the anchor to the box: the arrow's length. */
export const TIP_GAP = 10
/** The box keeps this far from the room's edges. */
const EDGE = 8
/** The arrow keeps this far from the box's corners. */
const ARROW_INSET = 16
/** Narrower than this, a side is not worth trying. */
const MIN_WIDTH = 96
/** Slide positions tried along a side, besides the centred one. */
const STEPS = 8

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function covered(box: Rect, rects: readonly Rect[]): number {
  return rects.reduce((sum, rect) => sum + overlapArea(box, rect), 0)
}

/** The widest a tooltip may be on a side, between its anchor and the edge. */
function roomFor(side: Side, anchor: Point, bounds: Rect): number {
  switch (side) {
    case 'above':
    case 'below':
      return bounds.w - 2 * EDGE
    case 'left':
      return anchor.x - TIP_GAP - (bounds.x + EDGE)
    case 'right':
      return bounds.x + bounds.w - EDGE - (anchor.x + TIP_GAP)
  }
}

/** Positions along an axis: centred on the anchor first, then a sweep. */
function slides(centre: number, lo: number, hi: number): number[] {
  if (hi < lo) return []
  const out = [Math.min(hi, Math.max(lo, centre))]
  for (let i = 0; i <= STEPS; i++) out.push(lo + ((hi - lo) * i) / STEPS)
  return out
}

interface Candidate extends TipPlace {
  readonly cost: number
  /** Wrapped past `maxHeight`. */
  readonly tall: boolean
}

function candidates(
  side: Side,
  anchor: Point,
  size: { w: number; h: number },
  bounds: Rect,
): { box: Rect; arrow: number }[] {
  const { w, h } = size
  const vertical = side === 'above' || side === 'below'
  if (vertical) {
    const y = side === 'above' ? anchor.y - TIP_GAP - h : anchor.y + TIP_GAP
    const lo = Math.max(bounds.x + EDGE, anchor.x - w + ARROW_INSET)
    const hi = Math.min(bounds.x + bounds.w - EDGE - w, anchor.x - ARROW_INSET)
    return slides(anchor.x - w / 2, lo, hi).map((x) => ({
      box: { x, y, w, h },
      arrow: anchor.x - x,
    }))
  }
  const x = side === 'left' ? anchor.x - TIP_GAP - w : anchor.x + TIP_GAP
  const lo = Math.max(bounds.y + EDGE, anchor.y - h + ARROW_INSET)
  const hi = Math.min(bounds.y + bounds.h - EDGE - h, anchor.y - ARROW_INSET)
  return slides(anchor.y - h / 2, lo, hi).map((y) => ({
    box: { x, y, w, h },
    arrow: anchor.y - y,
  }))
}

function inside(box: Rect, bounds: Rect): boolean {
  return (
    box.x >= bounds.x + EDGE - 0.5 &&
    box.y >= bounds.y + EDGE - 0.5 &&
    box.x + box.w <= bounds.x + bounds.w - EDGE + 0.5 &&
    box.y + box.h <= bounds.y + bounds.h - EDGE + 0.5
  )
}

/** Narrower widths a tooltip may wrap to, to keep off what it would cover. */
const NARROWER = [200, 168, 136, 112]

/** Every place on one side, at every width that fits there. */
function sideCandidates(
  request: TipRequest,
  side: Side,
  rank: number,
): Candidate[] {
  const anchor = request.anchors[side]
  if (anchor === undefined) return []
  const widest = Math.min(
    request.maxWidth,
    roomFor(side, anchor, request.bounds),
  )
  if (widest < MIN_WIDTH) return []
  const widths = [widest, ...NARROWER.filter((w) => w < widest)]
  const vertical = side === 'above' || side === 'below'
  const out: Candidate[] = []
  for (const width of widths) {
    const size = request.size(width)
    for (const { box, arrow } of candidates(
      side,
      anchor,
      size,
      request.bounds,
    )) {
      if (!inside(box, request.bounds)) continue
      const hard = covered(box, request.avoid)
      const soft = covered(box, request.prefer ?? [])
      const offCentre = Math.abs(
        vertical ? box.x + box.w / 2 - anchor.x : box.y + box.h / 2 - anchor.y,
      )
      out.push({
        side,
        box,
        arrow,
        anchor,
        clear: hard === 0,
        tall: size.h > (request.maxHeight ?? Infinity),
        // Wider reads better: a narrower wrap has to earn its place.
        cost: hard * 1e6 + soft * 4 + offCentre + rank * 120 + (widest - width),
      })
    }
  }
  return out
}

/** The best place for a tooltip, or null when no side has room at all. */
export function placeTip(request: TipRequest): TipPlace | null {
  const all = request.sides.flatMap((side, rank) =>
    sideCandidates(request, side, rank),
  )
  if (all.length === 0) return null
  const short = all.filter((candidate) => candidate.clear && !candidate.tall)
  const best = (short.length > 0 ? short : all).reduce((a, b) =>
    b.cost < a.cost ? b : a,
  )
  return {
    side: best.side,
    box: best.box,
    arrow: best.arrow,
    anchor: best.anchor,
    clear: best.clear,
  }
}

/** A rect grown by `by` on every side. */
export function inflate(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    w: rect.w + 2 * by,
    h: rect.h + 2 * by,
  }
}
