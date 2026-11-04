// Studio lane line places — where a line's value sits in its lane, how it reads, and the point edits a hand makes.
//
// A line is drawn over its lane's clips (StudioLaneLine.tsx): time runs
// across, as it does for the clips, and the value runs up the lane. Volume
// is straight in decibels from -60 dB at the foot to +12 dB at the top,
// as the fader is; pan runs from left at the top to right at the foot.
import type { StudioAutomationParam } from '@/lib/studio/model/automation'
import { STUDIO_AUTOMATION_RANGE, STUDIO_MAX_AUTOMATION_POINTS, } from '@/lib/studio/model/automation'
import type { StudioAutomationPoint } from '@/lib/studio/model/types'
import { studioPanLabel } from './StudioTrackControls'

/** Steps to a unit: a tenth of a decibel, a hundredth of the knob's travel. */
const STEPS_PER_UNIT: Readonly<Record<StudioAutomationParam, number>> = {
  volume: 10,
  pan: 100,
}

/** `value` on the line's travel and step. */
export function studioLineValue(
  param: StudioAutomationParam,
  value: number,
): number {
  const { min, max } = STUDIO_AUTOMATION_RANGE[param]
  const per = STEPS_PER_UNIT[param]
  // Adding zero turns a rounded -0 into 0.
  return Math.round(Math.max(min, Math.min(max, value)) * per) / per + 0
}

/** Where `value` sits down its lane, from 0 at the top to 1 at the foot. */
export function studioLineDepth(
  param: StudioAutomationParam,
  value: number,
): number {
  const { min, max } = STUDIO_AUTOMATION_RANGE[param]
  const along = (Math.max(min, Math.min(max, value)) - min) / (max - min)
  return param === 'volume' ? 1 - along : along
}

/** The value at `depth` down a lane, on the line's step. */
export function studioLineValueAtDepth(
  param: StudioAutomationParam,
  depth: number,
): number {
  const { min, max } = STUDIO_AUTOMATION_RANGE[param]
  const at = Math.max(0, Math.min(1, depth))
  const along = param === 'volume' ? 1 - at : at
  return studioLineValue(param, min + along * (max - min))
}

/** A line's value as it reads: `−6.0 dB`, `+2.5 dB`, `L40` or `C`. */
export function formatStudioLineValue(
  param: StudioAutomationParam,
  value: number,
): string {
  if (param === 'pan') return studioPanLabel(value)
  const shown = studioLineValue('volume', value)
  const sign = shown < 0 ? '\u2212' : shown > 0 ? '+' : ''
  return `${sign}${Math.abs(shown).toFixed(1)} dB`
}

/** How far an arrow key moves a point's value: a decibel or a twentieth of the knob, a tenth of that with Shift. */
export function studioLineKeyStep(
  param: StudioAutomationParam,
  fine: boolean,
): number {
  const step = param === 'volume' ? 1 : 0.05
  return fine ? step / 10 : step
}

/**
 * `points` with `point` added in time order, and the index it took. A
 * frame that already has a point keeps it, and that point's index comes
 * back. A full line takes no more: null.
 */
export function addStudioLinePoint(
  points: readonly StudioAutomationPoint[],
  point: StudioAutomationPoint,
): { points: readonly StudioAutomationPoint[]; index: number } | null {
  const taken = points.findIndex((item) => item.frame === point.frame)
  if (taken >= 0) return { points, index: taken }
  if (points.length >= STUDIO_MAX_AUTOMATION_POINTS) return null
  const after = points.findIndex((item) => item.frame > point.frame)
  const index = after < 0 ? points.length : after
  return {
    points: [...points.slice(0, index), point, ...points.slice(index)],
    index,
  }
}

/** The frames point `index` may move between: a frame past each neighbour. */
export function studioLinePointBounds(
  points: readonly StudioAutomationPoint[],
  index: number,
): { min: number; max: number } {
  return {
    min: index > 0 ? points[index - 1].frame + 1 : 0,
    max:
      index < points.length - 1
        ? points[index + 1].frame - 1
        : Number.MAX_SAFE_INTEGER,
  }
}

/** Point `index` moved to `frame` and `value`: between its neighbours, on a whole frame and the line's step. */
export function moveStudioLinePoint(
  points: readonly StudioAutomationPoint[],
  index: number,
  param: StudioAutomationParam,
  frame: number,
  value: number,
): readonly StudioAutomationPoint[] {
  const { min, max } = studioLinePointBounds(points, index)
  const moved = {
    frame: Math.round(Math.max(min, Math.min(max, frame))),
    value: studioLineValue(param, value),
  }
  return points.map((point, at) => (at === index ? moved : point))
}

export function removeStudioLinePoint(
  points: readonly StudioAutomationPoint[],
  index: number,
): readonly StudioAutomationPoint[] {
  return points.filter((_, at) => at !== index)
}

export function sameStudioLine(
  a: readonly StudioAutomationPoint[],
  b: readonly StudioAutomationPoint[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (point, at) => point.frame === b[at].frame && point.value === b[at].value,
    )
  )
}
