// ============================================================
// Studio note roll navigation — the wheel, a trackpad, one finger and a pinch move and zoom the roll, as they do the lanes
// ============================================================
//
// As over the lanes (timeline/lane-navigation.ts): Ctrl or Cmd with the
// wheel, and a trackpad's pinch, zoom about the pointer; a trackpad's
// sideways swipe and Shift with the wheel move through the clip; the wheel
// alone scrolls the rows when more rows are wanted than fit, and moves
// through the clip when they all show. On a touch screen one finger pans
// both ways and two fingers zoom about the point between them. A zoom and a
// pan stay inside the clip's window (lib/studio/midi/roll.ts); the rows
// move by whole rows (roll-keyboard.ts), the part of a row left over carried
// to the next move so a slow drag still gets there.
//
// D's editing engine moves the roll its own way, in fractions of a row
// (edit-viewport.ts); wired in, it takes over the pointer side of this.
import type { RollViewport } from '@/lib/roll-geometry'
import { rowHeight } from '@/lib/roll-geometry'
import { panStudioRoll, zoomStudioRoll } from '@/lib/studio/midi/roll'
import { scrollStudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { StudioPinchPoint } from '../timeline/lane-navigation'
import { studioPinchStep, studioWheelPixels } from '../timeline/lane-navigation'
import { isStudioWheelNotch, studioWheelZoomFactor, } from '../timeline/zoom-math'

/** A move of the roll: a zoom by `factor` (below 1 closes in) about `anchorX`, or a pan by pixels (right and down positive). */
export type StudioRollMove =
  | { readonly kind: 'zoom'; readonly factor: number; readonly anchorX: number }
  | { readonly kind: 'pan'; readonly x: number; readonly y: number }

type WheelInput = Pick<
  WheelEvent,
  'ctrlKey' | 'metaKey' | 'shiftKey' | 'deltaX' | 'deltaY' | 'deltaMode'
>

/** A notch of the wheel moves the roll at least this far, as it does the lanes. */
const NOTCH_PIXELS = 100

/**
 * What a wheel event over the roll does: a zoom about `anchorX` (the
 * pointer's x in the grid), or a pan. `rowsScroll` says whether the rows can
 * scroll; `pagePixels` is a page's worth of the wheel's pages.
 */
export function studioRollWheelMove(
  event: WheelInput,
  anchorX: number,
  rowsScroll: boolean,
  pagePixels: number,
): StudioRollMove | null {
  if (event.ctrlKey || event.metaKey) {
    const factor = studioWheelZoomFactor(event)
    return factor === 1 ? null : { kind: 'zoom', factor: 1 / factor, anchorX }
  }
  return wheelPan(event, rowsScroll, pagePixels)
}

/** A pan by the wheel: through the clip with Shift, or when the rows cannot scroll; else down the rows and across by a sideways swipe. */
function wheelPan(
  event: WheelInput,
  rowsScroll: boolean,
  pagePixels: number,
): StudioRollMove | null {
  const down = studioWheelPixels(event, pagePixels)
  const across = event.deltaMode === 1 ? event.deltaX * 33 : event.deltaX
  const notch = isStudioWheelNotch(event)
  const reach = (pixels: number) =>
    notch
      ? Math.sign(pixels) * Math.max(Math.abs(pixels), NOTCH_PIXELS)
      : pixels
  if (event.shiftKey || (!rowsScroll && across === 0))
    return down === 0 ? null : { kind: 'pan', x: reach(down), y: 0 }
  if (across === 0 && down === 0) return null
  return { kind: 'pan', x: across, y: rowsScroll ? reach(down) : 0 }
}

/** The roll after a move, and the part of a row its pan left over for the next one. */
export function moveStudioRoll(
  viewport: RollViewport,
  move: StudioRollMove,
  window: StudioTickWindow,
  topRow: number,
  carryRows = 0,
): { viewport: RollViewport; carryRows: number } {
  if (move.kind === 'zoom')
    return {
      viewport: zoomStudioRoll(viewport, move.factor, move.anchorX, window),
      carryRows,
    }
  const ticks =
    viewport.width > 0
      ? (move.x / viewport.width) * (viewport.end - viewport.start)
      : 0
  const across = ticks === 0 ? viewport : panStudioRoll(viewport, ticks, window)
  const height = rowHeight(viewport)
  // Dragging the rows down shows lower notes: the rows move the other way.
  const rows = carryRows + (height > 0 ? -move.y / height : 0)
  // A carry and a move that add up to a whole row reach it despite the
  // float's last bit.
  const whole = Math.trunc(rows + Math.sign(rows) * 1e-9)
  return {
    viewport:
      whole === 0 ? across : scrollStudioRollRows(across, whole, topRow),
    carryRows: rows - whole,
  }
}

interface TouchPoint {
  x: number
  y: number
}

/**
 * One finger pans and two fingers zoom, from pointer events on the roll.
 * Touch and pen only: a mouse is the editing gestures' (and the wheel's).
 * `apply` takes each move; `origin` gives the grid's left edge on the page,
 * so a pinch zooms about the point between the fingers. A finger counts
 * while the roll holds its capture (`holds`): a browser does not always
 * send the cancel it owes, and a finger it forgot must not turn the next
 * one into a pinch.
 */
export function createStudioRollTouch(options: {
  apply(move: StudioRollMove): void
  origin(): number
  holds?(pointerId: number): boolean
}) {
  const points = new Map<number, TouchPoint>()
  let pinch: StudioPinchPoint | null = null

  const pinchPoint = (): StudioPinchPoint => {
    const [a, b] = [...points.values()]
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }
  }

  function down(event: PointerEvent): boolean {
    if (event.pointerType === 'mouse') return false
    for (const id of points.keys())
      if (options.holds?.(id) === false) points.delete(id)
    points.set(event.pointerId, { x: event.clientX, y: event.clientY })
    pinch = points.size === 2 ? pinchPoint() : null
    return true
  }

  function move(event: PointerEvent): void {
    const point = points.get(event.pointerId)
    if (point === undefined) return
    const before = { ...point }
    point.x = event.clientX
    point.y = event.clientY
    if (points.size === 1) {
      options.apply({
        kind: 'pan',
        x: before.x - point.x,
        y: before.y - point.y,
      })
      return
    }
    if (pinch === null || points.size !== 2) return
    const now = pinchPoint()
    const step = studioPinchStep(pinch, now)
    pinch = now
    if (step.factor !== 1)
      options.apply({
        kind: 'zoom',
        factor: 1 / step.factor,
        anchorX: step.anchorX - options.origin(),
      })
    options.apply({ kind: 'pan', x: step.panX, y: step.panY })
  }

  function up(event: PointerEvent): void {
    points.delete(event.pointerId)
    pinch = points.size === 2 ? pinchPoint() : null
  }

  return {
    down,
    move,
    up,
    /** Whether a finger is on the roll. */
    active: () => points.size > 0,
  }
}
