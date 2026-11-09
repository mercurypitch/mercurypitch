// ============================================================
// Studio note snapping — the note editor's grid in ticks: the note values it offers, its lines through the song's bars, and where a dragged note lands on it
// ============================================================
//
// A grid line can fall on any tick. A sequence counts from its take's first
// sample, often a count-in before the song's bar, so the host hands over a
// tick a bar line falls on and every line runs through it.
//
// A drag snaps where the dragged note lands, not how far the pointer went:
// past half a step its start (or its end, for a resize) goes to the nearest
// line, and the rest of the selection moves by as much, so the notes keep
// their offsets from each other. Before half a step it stays put, so a drag
// up or down to change a note's pitch keeps the time it was played at.
import { STUDIO_PPQ } from '@/lib/studio/model/types'

/** The note values the grid offers, from the longest, then triplets, then Off. */
export const NOTE_SNAPS = [
  '1/4',
  '1/8',
  '1/16',
  '1/32',
  '1/4T',
  '1/8T',
  '1/16T',
  'off',
] as const

export type NoteSnap = (typeof NOTE_SNAPS)[number]

/** A sixteenth, as the mockups open. */
export const DEFAULT_NOTE_SNAP: NoteSnap = '1/16'

const SNAP_TICKS: Readonly<Record<NoteSnap, number | null>> = {
  '1/4': STUDIO_PPQ,
  '1/8': STUDIO_PPQ / 2,
  '1/16': STUDIO_PPQ / 4,
  '1/32': STUDIO_PPQ / 8,
  '1/4T': (STUDIO_PPQ * 2) / 3,
  '1/8T': STUDIO_PPQ / 3,
  '1/16T': STUDIO_PPQ / 6,
  off: null,
}

/** A grid's lines: `ticks` apart, one of them on `offset`. */
export interface NoteGridLines {
  readonly ticks: number
  readonly offset: number
}

/** Far below a tick: a tick on a line belongs to that line. */
const EPSILON = 1e-6

/** The grid `snap` sets, its lines through `offset`; null for Off. */
export function noteSnapGrid(snap: NoteSnap, offset = 0): NoteGridLines | null {
  const ticks = SNAP_TICKS[snap]
  return ticks === null ? null : { ticks, offset }
}

/**
 * The grid a step is counted on, which Off has too: a sixteenth, for the
 * length of a note drawn with a click and for Quantize.
 */
export function noteStepGrid(snap: NoteSnap, offset = 0): NoteGridLines {
  return noteSnapGrid(snap, offset) ?? { ticks: STUDIO_PPQ / 4, offset }
}

/** How many lines from the grid's offset `tick` is, unrounded. */
function linesTo(tick: number, grid: NoteGridLines): number {
  return (tick - grid.offset) / grid.ticks
}

/** The line nearest `tick`. */
export function snapNearest(tick: number, grid: NoteGridLines): number {
  return grid.offset + Math.round(linesTo(tick, grid)) * grid.ticks
}

/** The line at `tick` or before it: the start of the cell a press lands in. */
export function snapFloor(tick: number, grid: NoteGridLines): number {
  return grid.offset + Math.floor(linesTo(tick, grid) + EPSILON) * grid.ticks
}

/** The line at `tick` or after it: the end of the cell a drag reaches into. */
export function snapCeil(tick: number, grid: NoteGridLines): number {
  return grid.offset + Math.ceil(linesTo(tick, grid) - EPSILON) * grid.ticks
}

/** The first line after `tick`: the shortest a note from `tick` is on the grid. */
export function lineAfter(tick: number, grid: NoteGridLines): number {
  return snapFloor(tick, grid) + grid.ticks
}

/**
 * How far a dragged note's start (or end) moves when the pointer has
 * travelled `raw` ticks from where it pressed: nothing before half a step,
 * then onto the line nearest where it would land. Without a grid, the
 * travel itself, to the tick.
 */
export function snapTravel(
  origin: number,
  raw: number,
  grid: NoteGridLines | null,
): number {
  if (grid === null) return Math.round(raw)
  if (Math.abs(raw) < grid.ticks / 2) return 0
  return snapNearest(origin + raw, grid) - origin
}
