// The seam between the sheet's data and whatever draws it. A renderer answers
// two questions — how tall is one part, and how do I paint one system — and
// nothing else. Tab is the renderer that ships first; a staff-notation renderer
// can be dropped in beside it without the page, the layout or the tests moving.
//
// Geometry lives here rather than inside a painter so it can be asserted
// without a canvas, and so two renderers cannot drift into disagreeing about
// where a lane starts.

import type { SheetLane, SheetPlacement, SheetSystem } from './sheet-model'

export type SheetRendererId = 'tab' | 'notation'

/** Sizes the page hands a renderer. All in CSS pixels. */
export interface SheetMetrics {
  /** Drawable width of one system, inside its own padding. */
  width: number
  /** Gap between one string line and the next. */
  rowHeight: number
  /** Space above a lane for its name. */
  labelHeight: number
  /** Space between one lane and the next. */
  laneGap: number
  systemPaddingTop: number
  systemPaddingBottom: number
  /** Space kept at the left of every system for string labels. */
  gutterWidth: number
}

export const DEFAULT_SHEET_METRICS: Omit<SheetMetrics, 'width'> = {
  rowHeight: 13,
  labelHeight: 18,
  laneGap: 18,
  systemPaddingTop: 10,
  systemPaddingBottom: 14,
  gutterWidth: 26,
}

/**
 * Every colour a painter may use, read from the stylesheet rather than written
 * in code — restyling the sheet must never mean editing a renderer.
 */
export interface SheetTheme {
  staffLine: string
  barLine: string
  laneLabel: string
  noteText: string
  noteBackdrop: string
  scoredAccent: string
  mutedNoteText: string
}

/** Where one lane sits inside a system, and whether it is the graded part. */
export interface SheetLaneLayout {
  lane: SheetLane
  laneIndex: number
  top: number
  height: number
  scored: boolean
}

export interface SheetSystemLayout {
  lanes: readonly SheetLaneLayout[]
  height: number
}

export interface SheetSystemPaintArgs {
  ctx: CanvasRenderingContext2D
  system: SheetSystem
  placement: SheetPlacement
  layout: SheetSystemLayout
  metrics: SheetMetrics
  theme: SheetTheme
}

export interface SheetRenderer {
  id: SheetRendererId
  label: string
  /** Height one lane needs, before the gap that follows it. */
  laneHeight(lane: SheetLane, metrics: SheetMetrics): number
  paintSystem(args: SheetSystemPaintArgs): void
}

/** Stack the lanes of one system, scored part included wherever it was put. */
export function layoutSystemLanes(
  lanes: readonly SheetLane[],
  metrics: SheetMetrics,
  renderer: SheetRenderer,
  scoredTrackId?: string,
): SheetSystemLayout {
  const placed: SheetLaneLayout[] = []
  let top = metrics.systemPaddingTop

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex]
    if (lane === undefined) continue
    const height = renderer.laneHeight(lane, metrics)
    placed.push({
      lane,
      laneIndex,
      top,
      height,
      scored: lane.trackId === scoredTrackId,
    })
    top += height + metrics.laneGap
  }

  // The trailing gap belongs between lanes, not under the last one.
  const contentBottom = placed.length === 0 ? top : top - metrics.laneGap
  return {
    lanes: placed,
    height: contentBottom + metrics.systemPaddingBottom,
  }
}

export interface VisibleSystemRangeInput {
  scrollTop: number
  viewportHeight: number
  systemHeight: number
  systemCount: number
  /** Systems kept mounted either side, so scrolling never shows a blank row. */
  overscan?: number
}

/**
 * Which systems are worth mounting. Every system is the same height, so this is
 * arithmetic rather than measurement — the page can hold a long score without
 * ever building the parts of it nobody is looking at.
 */
export function visibleSystemRange(input: VisibleSystemRangeInput): {
  start: number
  end: number
} {
  const { systemCount } = input
  if (systemCount <= 0) return { start: 0, end: 0 }
  if (!(input.systemHeight > 0)) return { start: 0, end: systemCount }

  const overscan = Math.max(0, Math.round(input.overscan ?? 1))
  const scrollTop = Number.isFinite(input.scrollTop)
    ? Math.max(0, input.scrollTop)
    : 0
  const viewportHeight = Number.isFinite(input.viewportHeight)
    ? Math.max(0, input.viewportHeight)
    : 0

  const first = Math.floor(scrollTop / input.systemHeight) - overscan
  const last =
    Math.ceil((scrollTop + viewportHeight) / input.systemHeight) + overscan

  return {
    start: Math.max(0, Math.min(systemCount, first)),
    end: Math.max(0, Math.min(systemCount, last)),
  }
}

/** Read the sheet's palette off an element, with values that work unstyled. */
export function readSheetTheme(element: Element | null): SheetTheme {
  const fallback: SheetTheme = {
    staffLine: 'rgba(224, 205, 178, 0.28)',
    barLine: 'rgba(224, 205, 178, 0.55)',
    laneLabel: 'rgba(238, 226, 208, 0.72)',
    noteText: '#f6ecdc',
    noteBackdrop: 'rgba(18, 14, 11, 0.92)',
    scoredAccent: '#e0a45d',
    mutedNoteText: 'rgba(238, 226, 208, 0.6)',
  }
  if (element === null || typeof window === 'undefined') return fallback

  const style = window.getComputedStyle(element)
  const read = (name: string, value: string): string => {
    const custom = style.getPropertyValue(name).trim()
    return custom === '' ? value : custom
  }

  return {
    staffLine: read('--sheet-staff-line', fallback.staffLine),
    barLine: read('--sheet-bar-line', fallback.barLine),
    laneLabel: read('--sheet-lane-label', fallback.laneLabel),
    noteText: read('--sheet-note-text', fallback.noteText),
    noteBackdrop: read('--sheet-note-backdrop', fallback.noteBackdrop),
    scoredAccent: read('--sheet-scored-accent', fallback.scoredAccent),
    mutedNoteText: read('--sheet-muted-note-text', fallback.mutedNoteText),
  }
}
