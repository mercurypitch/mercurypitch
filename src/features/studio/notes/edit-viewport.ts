// ============================================================
// Studio note roll navigation — fingers, the wheel and a drag held at an edge slide and zoom the note editor's roll, time inside the clip's window and rows on the keyboard
// ============================================================
//
// The roll follows a finger both ways: time through roll.ts, rows through
// roll-rows.ts, in fractions of a row. A pinch zooms each axis by how far
// the fingers spread along it, about the point between them: apart sideways
// for time, apart up and down for rows, both at a slant. An axis the
// fingers are not spread along keeps its zoom, since a small spread makes a
// ratio that jumps with every wobble. A row stays at least 14 px tall, so a
// note stays a finger's target, and grows to 48 px at the most.
//
// The wheel scrolls the rows, Shift with it time, and a trackpad's
// sideways scroll time too; Ctrl or Cmd with it zooms time about the
// pointer, as over the Studio's lanes (timeline/lane-navigation.ts).
//
// A drag held near an edge, or past it, scrolls the roll that way, faster
// the further in, so a note can be dragged anywhere in the clip. It scrolls
// only toward the side the drag went, so grabbing a note near an edge does
// not scroll on its own.
import { studioWheelPixels } from '@/features/studio/timeline/lane-navigation'
import { studioWheelZoomFactor } from '@/features/studio/timeline/zoom-math'
import type { RollViewport } from '@/lib/roll-geometry'
import { rowHeight } from '@/lib/roll-geometry'
import { panStudioRoll, zoomStudioRoll } from '@/lib/studio/midi/roll'
import type { StudioRollRowLimits } from '@/lib/studio/midi/roll-rows'
import { panStudioRollRows, zoomStudioRollRows, } from '@/lib/studio/midi/roll-rows'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { NoteEditWheel } from './edit-types'

/** How tall a pinch may make a row. */
export const NOTE_ROW_LIMITS: StudioRollRowLimits = {
  minRowHeight: 14,
  maxRowHeight: 48,
}

/** How far apart along an axis two fingers are before a pinch zooms it. */
const PINCH_SPREAD = 32
/** How near an edge a drag scrolls, how deep in it reaches full speed, and that speed, in pixels and pixels a second. */
const EDGE_BAND = 24
const EDGE_RAMP = 72
const EDGE_SPEED = 900

/** A point on the roll, in CSS pixels. */
export interface NoteRollPoint {
  readonly x: number
  readonly y: number
}

/** Ticks a pixel spans. */
function ticksPerPixel(viewport: RollViewport): number {
  return viewport.width > 0
    ? (viewport.end - viewport.start) / viewport.width
    : 0
}

const VIEWPORT_FIELDS = [
  'start',
  'end',
  'minMidi',
  'maxMidi',
  'width',
  'height',
] as const satisfies readonly (keyof RollViewport)[]

/** Whether two viewports show the same thing. */
export function sameRollViewport(a: RollViewport, b: RollViewport): boolean {
  return a === b || VIEWPORT_FIELDS.every((field) => a[field] === b[field])
}

/** The roll after its content followed a finger `dx`, `dy` pixels: time inside the window, rows on the keyboard. */
export function dragNoteRoll(
  viewport: RollViewport,
  window: StudioTickWindow,
  dx: number,
  dy: number,
): RollViewport {
  const timed =
    dx === 0
      ? viewport
      : panStudioRoll(viewport, -dx * ticksPerPixel(viewport), window)
  const height = rowHeight(viewport)
  return dy === 0 || height <= 0 ? timed : panStudioRollRows(timed, dy / height)
}

/** Two fingers. */
export interface NoteFingers {
  readonly a: NoteRollPoint
  readonly b: NoteRollPoint
}

function midpoint(fingers: NoteFingers): NoteRollPoint {
  return {
    x: (fingers.a.x + fingers.b.x) / 2,
    y: (fingers.a.y + fingers.b.y) / 2,
  }
}

/** What a pinch zooms an axis by: the fingers' old spread along it over their new one, once they are spread along it; never more than double or half at once. */
function spreadFactor(before: number, after: number): number {
  if (before < PINCH_SPREAD || after < PINCH_SPREAD) return 1
  return Math.min(2, Math.max(0.5, before / after))
}

/**
 * The roll after two fingers moved from `before` to `after`: the point
 * between them pans the roll with it, and each axis zooms about that point
 * by how far the fingers spread along it. `rows` is false when a finger is
 * on the velocity lane, whose y is not a pitch.
 */
export function pinchNoteRoll(
  viewport: RollViewport,
  window: StudioTickWindow,
  before: NoteFingers,
  after: NoteFingers,
  rows: boolean,
): RollViewport {
  const from = midpoint(before)
  const to = midpoint(after)
  const panned = dragNoteRoll(
    viewport,
    window,
    to.x - from.x,
    rows ? to.y - from.y : 0,
  )
  const time = spreadFactor(
    Math.abs(before.a.x - before.b.x),
    Math.abs(after.a.x - after.b.x),
  )
  const timed = time === 1 ? panned : zoomStudioRoll(panned, time, to.x, window)
  if (!rows) return timed
  const pitch = spreadFactor(
    Math.abs(before.a.y - before.b.y),
    Math.abs(after.a.y - after.b.y),
  )
  return zoomStudioRollRows(timed, pitch, to.y, NOTE_ROW_LIMITS)
}

/** The roll after a wheel event over it. */
export function wheelNoteRoll(
  viewport: RollViewport,
  window: StudioTickWindow,
  wheel: NoteEditWheel,
): RollViewport {
  const deltaMode = wheel.deltaMode ?? 0
  if (wheel.mod === true) {
    const zoom = studioWheelZoomFactor({ deltaY: wheel.deltaY, deltaMode })
    return zoomStudioRoll(viewport, 1 / zoom, wheel.x, window)
  }
  const dx = studioWheelPixels(
    { deltaY: wheel.deltaX, deltaMode },
    viewport.width,
  )
  const dy = studioWheelPixels(
    { deltaY: wheel.deltaY, deltaMode },
    viewport.height,
  )
  if (wheel.shift === true)
    return dragNoteRoll(viewport, window, -(dx === 0 ? dy : dx), 0)
  return dragNoteRoll(viewport, window, -dx, -dy)
}

/** How fast a pointer `depth` pixels into an edge's band scrolls, in pixels a second. */
function edgeSpeed(depth: number): number {
  return EDGE_SPEED * Math.min(1, depth / EDGE_RAMP)
}

/** Scrolling along one axis, in pixels a second: toward the low edge negative. */
function axisScroll(position: number, size: number, travelled: number): number {
  const low = EDGE_BAND - position
  const high = position - (size - EDGE_BAND)
  if (low > 0 && travelled < 0) return -edgeSpeed(low)
  if (high > 0 && travelled > 0) return edgeSpeed(high)
  return 0
}

/**
 * How far, in pixels each way, the roll scrolls in `seconds` under a drag
 * at `at` that started at `from`: toward an edge it is near or past, if the
 * drag went that way. `rows` is false for a drag along time alone.
 */
export function noteEdgeScroll(
  viewport: RollViewport,
  at: NoteRollPoint,
  from: NoteRollPoint,
  seconds: number,
  rows: boolean,
): NoteRollPoint {
  return {
    x: axisScroll(at.x, viewport.width, at.x - from.x) * seconds,
    y: rows ? axisScroll(at.y, viewport.height, at.y - from.y) * seconds : 0,
  }
}
