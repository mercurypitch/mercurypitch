// Highway geometry maps one musical scene onto either frets or string lanes.
// ============================================================

import type { TabPresentation } from '../TabRenderer'

export const TAB_WALL_HALF_WIDTH = 6
export const TAB_WALL_BOTTOM = 0
export const TAB_WALL_TOP = 3.5
export const TAB_FLOOR_DEPTH = 44
export const TAB_STRING_MARGIN = 0.3
export const TAB_FRET_MARGIN = 0.4
export const TAB_LANE_HEIGHT = 0.18

export type TabWorldPoint = [number, number, number]

export function tabFretX(fret: number, maxFret: number): number {
  const left = -TAB_WALL_HALF_WIDTH + TAB_FRET_MARGIN
  const right = TAB_WALL_HALF_WIDTH - TAB_FRET_MARGIN
  return left + (maxFret > 0 ? fret / maxFret : 0.5) * (right - left)
}

export function tabFretStringY(
  stringIndex: number,
  stringCount: number,
): number {
  const top = TAB_WALL_TOP - TAB_STRING_MARGIN
  const bottom = TAB_WALL_BOTTOM + TAB_STRING_MARGIN
  return (
    top -
    (stringCount > 1 ? stringIndex / (stringCount - 1) : 0.5) * (top - bottom)
  )
}

export function tabStringLaneX(
  stringIndex: number,
  stringCount: number,
  leftHanded: boolean,
): number {
  const left = -TAB_WALL_HALF_WIDTH + TAB_FRET_MARGIN
  const right = TAB_WALL_HALF_WIDTH - TAB_FRET_MARGIN
  const ratio = stringCount > 1 ? stringIndex / (stringCount - 1) : 0.5
  const x = left + ratio * (right - left)
  return leftHanded ? -x : x
}

export function tabLandingPoint(
  presentation: TabPresentation,
  stringIndex: number,
  fret: number,
  stringCount: number,
  maxFret: number,
  leftHanded: boolean,
): TabWorldPoint {
  if (presentation === 'string-highway') {
    return [
      tabStringLaneX(stringIndex, stringCount, leftHanded),
      TAB_LANE_HEIGHT,
      0,
    ]
  }
  const x = tabFretX(fret, maxFret)
  // Grid keeps the legacy surface orientation until its wires and labels can
  // be mirrored as one unit; mirroring only targets would put them on the
  // opposite fret from the drawn board.
  return [x, tabFretStringY(stringIndex, stringCount), 0]
}

export function tabFlightPoint(
  presentation: TabPresentation,
  stringIndex: number,
  fret: number,
  depthRatio: number,
  stringCount: number,
  maxFret: number,
  leftHanded: boolean,
): TabWorldPoint {
  const [x, y] = tabLandingPoint(
    presentation,
    stringIndex,
    fret,
    stringCount,
    maxFret,
    leftHanded,
  )
  return [x, y, depthRatio === 0 ? 0 : -depthRatio * TAB_FLOOR_DEPTH]
}

export function tabTransverseWorldSpan(
  presentation: TabPresentation,
  _stringIndex: number,
  _fret: number,
  stringCount: number,
  maxFret: number,
): number {
  const usableWidth = (TAB_WALL_HALF_WIDTH - TAB_FRET_MARGIN) * 2
  return presentation === 'string-highway'
    ? usableWidth / Math.max(1, stringCount - 1)
    : usableWidth / Math.max(1, maxFret)
}

/** Tighten a lane toward the vanishing point without moving its NOW position. */
export function tabConvergedX(
  x: number,
  depthRatio: number,
  farScale: number,
): number {
  const depth = Math.max(0, Math.min(1, depthRatio))
  const scale = Math.max(0, Math.min(1, farScale))
  return x * (1 - depth * (1 - scale))
}
