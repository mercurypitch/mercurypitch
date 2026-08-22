// ============================================================
// Guitar Night secondary-part layout — bounded floating-panel geometry
// ============================================================
//
// The panel is movable, but the stage's live signal, display controls and
// gesture hint remain protected. Keep the collision policy pure so pointer,
// keyboard and resize paths all make the same placement decision.

export interface SecondaryPartPoint {
  x: number
  y: number
}

export interface SecondaryPartSize {
  width: number
  height: number
}

export interface SecondaryPartRect
  extends SecondaryPartPoint, SecondaryPartSize {}

export interface SecondaryPartLayout extends SecondaryPartPoint {
  width: number
}

export interface SecondaryPartLayoutOptions {
  edgeGap: number
  protectedGap: number
  minWidth: number
  maxWidth: number
  maxWidthRatio: number
}

export const SECONDARY_PART_LAYOUT_OPTIONS: SecondaryPartLayoutOptions = {
  edgeGap: 12,
  protectedGap: 10,
  minWidth: 240,
  maxWidth: 560,
  maxWidthRatio: 0.62,
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

export function secondaryPartWidthRange(
  boundaryWidth: number,
  options: SecondaryPartLayoutOptions = SECONDARY_PART_LAYOUT_OPTIONS,
): { min: number; max: number } {
  const width = Math.max(0, finiteOr(boundaryWidth, 0))
  const edgeGap = Math.max(0, finiteOr(options.edgeGap, 0))
  const innerWidth = Math.max(0, width - edgeGap * 2)
  const max = Math.min(
    Math.max(0, finiteOr(options.maxWidth, innerWidth)),
    Math.max(0, width * finiteOr(options.maxWidthRatio, 1)),
    innerWidth,
  )
  return {
    min: Math.min(Math.max(0, finiteOr(options.minWidth, 0)), max),
    max,
  }
}

function inflateRect(
  rect: SecondaryPartRect,
  amount: number,
): SecondaryPartRect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: Math.max(0, rect.width + amount * 2),
    height: Math.max(0, rect.height + amount * 2),
  }
}

function overlapArea(
  left: SecondaryPartRect,
  right: SecondaryPartRect,
): number {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  )
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  )
  return width * height
}

function unique(values: readonly number[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const value of values) {
    const rounded = Math.round(value * 1000) / 1000
    if (seen.has(rounded)) continue
    seen.add(rounded)
    result.push(rounded)
  }
  return result
}

/**
 * Clamp a desired panel layout to the stage and move it around protected
 * rectangles. If a very small viewport makes a collision unavoidable, the
 * least-overlapping valid placement wins instead of pushing the panel offstage.
 */
export function resolveSecondaryPartLayout(
  desired: SecondaryPartLayout,
  panelHeight: number,
  boundary: SecondaryPartSize,
  protectedRects: readonly SecondaryPartRect[],
  options: SecondaryPartLayoutOptions = SECONDARY_PART_LAYOUT_OPTIONS,
): SecondaryPartLayout {
  const boundaryWidth = Math.max(0, finiteOr(boundary.width, 0))
  const boundaryHeight = Math.max(0, finiteOr(boundary.height, 0))
  const edgeGap = Math.max(0, finiteOr(options.edgeGap, 0))
  const widthRange = secondaryPartWidthRange(boundaryWidth, options)
  const width = clamp(
    finiteOr(desired.width, widthRange.min),
    widthRange.min,
    widthRange.max,
  )
  const height = Math.min(
    Math.max(0, finiteOr(panelHeight, 0)),
    Math.max(0, boundaryHeight - edgeGap * 2),
  )
  const minX = edgeGap
  const minY = edgeGap
  const maxX = Math.max(minX, boundaryWidth - edgeGap - width)
  const maxY = Math.max(minY, boundaryHeight - edgeGap - height)
  const desiredX = clamp(finiteOr(desired.x, minX), minX, maxX)
  const desiredY = clamp(finiteOr(desired.y, maxY), minY, maxY)

  const obstacles = protectedRects
    .filter(
      (rect) =>
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height) &&
        rect.width > 0 &&
        rect.height > 0,
    )
    .map((rect) => inflateRect(rect, options.protectedGap))

  const xCandidates = unique([
    desiredX,
    minX,
    maxX,
    ...obstacles.flatMap((rect) => [rect.x - width, rect.x + rect.width]),
  ]).map((value) => clamp(value, minX, maxX))
  const yCandidates = unique([
    desiredY,
    minY,
    maxY,
    ...obstacles.flatMap((rect) => [rect.y - height, rect.y + rect.height]),
  ]).map((value) => clamp(value, minY, maxY))

  let best: {
    x: number
    y: number
    overlap: number
    distance: number
  } | null = null

  for (const x of xCandidates) {
    for (const y of yCandidates) {
      const candidate = { x, y, width, height }
      const overlap = obstacles.reduce(
        (sum, obstacle) => sum + overlapArea(candidate, obstacle),
        0,
      )
      const distance = (x - desiredX) ** 2 + (y - desiredY) ** 2
      if (
        best === null ||
        overlap < best.overlap ||
        (overlap === best.overlap && distance < best.distance)
      ) {
        best = { x, y, overlap, distance }
      }
    }
  }

  return {
    x: best?.x ?? desiredX,
    y: best?.y ?? desiredY,
    width,
  }
}

export function secondaryPartRectsOverlap(
  left: SecondaryPartRect,
  right: SecondaryPartRect,
  gap = 0,
): boolean {
  return overlapArea(left, inflateRect(right, Math.max(0, gap))) > 0
}
