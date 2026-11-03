// Studio lane automation — a lane's volume and pan as lines over the song, straight between points and flat beyond them.
//
// A line belongs to its lane, not to a clip: it reads the song's frames, so
// a clip moved along the lane plays at the line's values where it lands,
// and a clip copied to a new lane takes its lane's lines along, as it takes
// the lane's fader and effects. While a line has a point it replaces its
// control, the fader or the pan knob; clearing it hands the lane back.
// Playback follows a line on the lane's own gains (graph-automation.ts).
import type { StudioAutomationPoint, StudioLaneAutomation, StudioProject, StudioTrack, } from './types'
import { requireValue } from './validation-values'

export type StudioAutomationParam = 'volume' | 'pan'

export const STUDIO_AUTOMATION_PARAMS: readonly StudioAutomationParam[] = [
  'volume',
  'pan',
]

/** Each line's travel: the fader's, in decibels, and the knob's, -1 left to 1 right. */
export const STUDIO_AUTOMATION_RANGE: Readonly<
  Record<StudioAutomationParam, { readonly min: number; readonly max: number }>
> = {
  volume: { min: -60, max: 12 },
  pan: { min: -1, max: 1 },
}

/** The most points one line keeps. */
export const STUDIO_MAX_AUTOMATION_POINTS = 256

export interface StudioAutomationEdit {
  readonly type: 'set-lane-automation'
  readonly trackId: string
  readonly param: StudioAutomationParam
  /** The whole line, in any order; a later point on the same frame wins. Empty clears it. */
  readonly points: readonly StudioAutomationPoint[]
}

/** A lane's line for `param`, empty when it has none. */
export function studioAutomationLine(
  track: StudioTrack,
  param: StudioAutomationParam,
): readonly StudioAutomationPoint[] {
  return track.automation?.[param] ?? []
}

/** Whether a lane has a line for `param`, or any line when none is named. */
export function hasStudioAutomation(
  track: StudioTrack,
  param?: StudioAutomationParam,
): boolean {
  const params = param === undefined ? STUDIO_AUTOMATION_PARAMS : [param]
  return params.some((name) => studioAutomationLine(track, name).length > 0)
}

/** A line's value at `frame`: straight between its points, flat beyond its ends; null with no points. */
export function studioAutomationValueAt(
  points: readonly StudioAutomationPoint[],
  frame: number,
): number | null {
  if (points.length === 0) return null
  const last = points.length - 1
  if (frame <= points[0].frame) return points[0].value
  if (frame >= points[last].frame) return points[last].value
  let low = 0
  let high = last
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (points[middle].frame <= frame) low = middle
    else high = middle
  }
  const from = points[low]
  const to = points[high]
  return (
    from.value +
    ((to.value - from.value) * (frame - from.frame)) / (to.frame - from.frame)
  )
}

/** What a lane's control reads at `frame`: its line, or the fader or the knob when it has none. */
export function studioLaneValueAt(
  track: StudioTrack,
  param: StudioAutomationParam,
  frame: number,
): number {
  return (
    studioAutomationValueAt(studioAutomationLine(track, param), frame) ??
    (param === 'volume' ? track.gainDb : track.pan)
  )
}

/** A line in time order with one point to a frame: the last given for a frame wins. */
export function sortStudioAutomation(
  points: readonly StudioAutomationPoint[],
): StudioAutomationPoint[] {
  const byFrame = new Map<number, StudioAutomationPoint>()
  for (const { frame, value } of points) byFrame.set(frame, { frame, value })
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

/**
 * `track` with its `param` line set to `points`, sorted. Empty clears the
 * line, and a lane left with no line has no automation at all, so a song
 * stores one shape for "no lines".
 */
export function withStudioAutomation(
  track: StudioTrack,
  param: StudioAutomationParam,
  points: readonly StudioAutomationPoint[],
): StudioTrack {
  const { automation, ...rest } = track
  const next: StudioLaneAutomation = {
    ...automation,
    [param]: points.length > 0 ? sortStudioAutomation(points) : undefined,
  }
  const lines = Object.fromEntries(
    STUDIO_AUTOMATION_PARAMS.flatMap((name) =>
      (next[name]?.length ?? 0) > 0 ? [[name, next[name]]] : [],
    ),
  ) as StudioLaneAutomation
  return Object.keys(lines).length > 0 ? { ...rest, automation: lines } : rest
}

export function applyStudioAutomationEdit(
  project: StudioProject,
  edit: StudioAutomationEdit,
): StudioProject {
  requireValue(
    STUDIO_AUTOMATION_PARAMS.includes(edit.param),
    `track.${edit.trackId}.automation`,
    'Unknown line',
  )
  requireValue(
    project.tracks.some((track) => track.id === edit.trackId),
    `track.${edit.trackId}`,
    'Lane does not exist',
  )
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === edit.trackId
        ? withStudioAutomation(track, edit.param, edit.points)
        : track,
    ),
  }
}

export function isStudioAutomationEdit(edit: {
  type: string
}): edit is StudioAutomationEdit {
  return edit.type === 'set-lane-automation'
}
