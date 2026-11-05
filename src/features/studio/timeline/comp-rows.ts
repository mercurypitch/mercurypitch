// ============================================================
// Studio comp rows — comping a loop take on the song's grid: its passes newest first, where each plays, where a swipe, a key or a tap lands
// ============================================================
//
// A comp is kept in the clip's own source frames (clip-comp.ts), and the
// rows under a lane draw and snap on the song's timeline. These turn one
// into the other: a swipe snaps to the grid the ruler draws, a key moves a
// selection one grid cell, and a phone's cells are the song's bars. A grid
// cell is the stretch between two of its lines, cut to the clip, so every
// span here lies inside the clip.
//
// Passes stand newest on top, right under the clip: the newest is the one
// sung with the most practice, and the first a singer compares against.
import type { StudioCompEdit } from '@/lib/studio/model/clip-comp'
import { studioClipComp, studioCompPassAt } from '@/lib/studio/model/clip-comp'
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_BEATS_PER_BAR, studioBeatFrames, } from '@/lib/studio/record/take-timing'
import { clipEndFrame } from './timeline-geometry'

/** A stretch of the clip's own source frames. */
export interface StudioCompSpan {
  readonly from: number
  readonly to: number
}

/** One pass as a row: `pass` counted from 0, `number` from 1, oldest first. */
export interface StudioCompRow {
  readonly pass: number
  readonly number: number
}

/** A loop take's passes as rows, the newest on top. */
export function studioCompRows(clip: StudioClip): StudioCompRow[] {
  const count = clip.passes?.count ?? 0
  return Array.from({ length: count }, (_, row) => ({
    pass: count - 1 - row,
    number: count - row,
  }))
}

/** Where `pass` plays over the clip: its stretches of the comp, or all of it when the clip plays it whole. */
export function studioCompLit(
  clip: StudioClip,
  pass: number,
): StudioCompSpan[] {
  return (studioClipComp(clip) ?? [])
    .filter((part) => part.pass === pass)
    .map((part) => ({ from: part.fromSourceFrame, to: part.toSourceFrame }))
}

/** The stretches where another pass plays, side by side as one: the pass dims there. */
export function studioCompUnlit(
  clip: StudioClip,
  pass: number,
): StudioCompSpan[] {
  const spans: { from: number; to: number }[] = []
  for (const part of studioClipComp(clip) ?? []) {
    if (part.pass === pass) continue
    const last = spans.at(-1)
    if (last?.to === part.fromSourceFrame) last.to = part.toSourceFrame
    else spans.push({ from: part.fromSourceFrame, to: part.toSourceFrame })
  }
  return spans
}

/** One of the clip's source frames on the song's timeline. */
export function studioCompTimelineFrame(
  clip: StudioClip,
  sourceFrame: number,
): number {
  return clip.startFrame + sourceFrame - clip.sourceInFrame
}

/** A frame of the song's timeline as one of the clip's own, kept inside the clip. */
function sourceInside(clip: StudioClip, timelineFrame: number): number {
  return Math.max(
    clip.sourceInFrame,
    Math.min(
      clip.sourceOutFrame,
      clip.sourceInFrame + Math.round(timelineFrame) - clip.startFrame,
    ),
  )
}

/** Grid line `index`, where the ruler draws it (studioGridFrame). */
const lineAt = (index: number, grid: number) => Math.round(index * grid)

/** The grid cell holding a frame of the timeline: the one whose first line is at or before it. */
function cellAt(frame: number, grid: number): number {
  let index = Math.floor(frame / grid)
  while (lineAt(index + 1, grid) <= frame) index++
  while (lineAt(index, grid) > frame) index--
  return index
}

/** Cells `first` to `last` of the grid, cut to the clip. */
function cellsSpan(
  clip: StudioClip,
  first: number,
  last: number,
  grid: number,
): StudioCompSpan {
  return {
    from: sourceInside(clip, lineAt(first, grid)),
    to: sourceInside(clip, lineAt(last + 1, grid)),
  }
}

/** A source frame of the clip on the grid line nearest it, or as it is with no grid: inside the clip either way. */
export function studioCompSnap(
  clip: StudioClip,
  sourceFrame: number,
  grid: number | null,
): number {
  const frame = studioCompTimelineFrame(clip, sourceFrame)
  if (grid === null || !(grid > 0)) return sourceInside(clip, frame)
  return sourceInside(clip, lineAt(Math.round(frame / grid), grid))
}

/** What a swipe between two of the clip's source frames does to `pass`: plays it there, or nothing for a swipe that covers no frame. */
export function studioCompSwipe(
  clip: StudioClip,
  pass: number,
  from: number,
  to: number,
): StudioCompEdit | null {
  const first = Math.max(clip.sourceInFrame, Math.min(from, to))
  const last = Math.min(clip.sourceOutFrame, Math.max(from, to))
  if (last <= first) return null
  return {
    type: 'comp-pass',
    clipId: clip.id,
    fromSourceFrame: first,
    toSourceFrame: last,
    pass,
  }
}

/** The grid cell under one of the clip's source frames, cut to the clip. */
export function studioCompCell(
  clip: StudioClip,
  sourceFrame: number,
  grid: number,
): StudioCompSpan {
  const cell = cellAt(studioCompTimelineFrame(clip, sourceFrame), grid)
  return cellsSpan(clip, cell, cell, grid)
}

/** Where a keyboard selection starts: the cell under the playhead, or the clip's first. */
export function studioCompStartSpan(
  clip: StudioClip,
  playheadFrame: number,
  grid: number,
): StudioCompSpan {
  const inside =
    playheadFrame >= clip.startFrame && playheadFrame < clipEndFrame(clip)
  return studioCompCell(
    clip,
    inside
      ? clip.sourceInFrame + playheadFrame - clip.startFrame
      : clip.sourceInFrame,
    grid,
  )
}

/**
 * A keyboard selection moved one grid cell, `step` -1 for left and 1 for
 * right, or with `resize` its far end moved instead. It keeps whole cells,
 * one at least, and stays on the clip.
 */
export function studioCompStep(
  clip: StudioClip,
  span: StudioCompSpan,
  grid: number,
  step: -1 | 1,
  resize: boolean,
): StudioCompSpan {
  const lowest = cellAt(clip.startFrame, grid)
  const highest = cellAt(clipEndFrame(clip) - 1, grid)
  let first = cellAt(studioCompTimelineFrame(clip, span.from), grid)
  let last = cellAt(studioCompTimelineFrame(clip, span.to) - 1, grid)
  if (resize) last = Math.max(first, Math.min(highest, last + step))
  else {
    const shift = Math.max(lowest - first, Math.min(highest - last, step))
    first += shift
    last += shift
  }
  return cellsSpan(clip, first, last, grid)
}

/** One of the song's bars over a clip, cut to it: a phone's cell. */
export interface StudioCompBar extends StudioCompSpan {
  /** Counted from 1, as the ruler counts bars. */
  readonly bar: number
  /** The pass playing there, read at the middle of the cell. */
  readonly pass: number
}

/** The most bars a phone lays out for one clip. */
export const STUDIO_COMP_MAX_BARS = 256

/** The song's bars over a loop take's clip, at the song's tempo, each with the pass playing it. */
export function studioCompBars(
  clip: StudioClip,
  tempoBpm: number,
): StudioCompBar[] {
  const grid = studioBeatFrames(tempoBpm) * STUDIO_BEATS_PER_BAR
  const first = cellAt(clip.startFrame, grid)
  const last = Math.min(
    cellAt(clipEndFrame(clip) - 1, grid),
    first + STUDIO_COMP_MAX_BARS - 1,
  )
  return Array.from({ length: last - first + 1 }, (_, at) => {
    const span = cellsSpan(clip, first + at, first + at, grid)
    return {
      ...span,
      bar: first + at + 1,
      pass: studioCompPassAt(clip, Math.floor((span.from + span.to) / 2)) ?? 0,
    }
  })
}
