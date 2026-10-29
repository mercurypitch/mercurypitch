// ============================================================
// Studio lane timeline — when each of one lane's clips starts, pass by pass, so a lane can be re-planned while the others play on
// ============================================================
//
// Every lane keeps a timeline of its own: one pass of its segments, timed
// from the graph's shared anchor, and the pass it is scheduling. The lanes
// share the anchor (when one frame enters a lane with no compensation) and
// the loop's length, so they stay on the same frames; a clip edit rebuilds
// only the timeline of the lane it changed.
import type { StudioPlannedSegment } from '../model/arrangement-plan'
import { STUDIO_SAMPLE_RATE } from '../model/types'

/** A segment's place in one pass: seconds after the pass starts, its lane's compensation included. */
export interface StudioPlanned {
  readonly segment: StudioPlannedSegment
  readonly base: number
}

/** A segment as it is started: its source starts at `when` on the context clock. */
export interface StudioScheduled {
  readonly segment: StudioPlannedSegment
  readonly when: number
}

/** One lane's place in its schedule. */
export interface StudioLaneTimeline {
  /** One whole pass, timed for pass 0 of the anchor; later passes shift it by whole loops. */
  cycle: StudioScheduled[]
  /** The pass being scheduled, which runs up to two seconds ahead of the one heard. */
  scheduled: StudioScheduled[]
  next: number
  pass: number
}

/** A segment's last frame, exclusive. */
export function segmentEnd(segment: StudioPlannedSegment): number {
  return segment.startFrame + segment.sourceOutFrame - segment.sourceInFrame
}

/** Each segment's place in a pass of a plan that starts at `planStart`. */
export function plannedSegments(
  segments: readonly StudioPlannedSegment[],
  planStart: number,
  compensation: number,
): StudioPlanned[] {
  return segments.map((segment) => ({
    segment,
    base: (segment.startFrame - planStart) / STUDIO_SAMPLE_RATE + compensation,
  }))
}

/** One pass of a lane, its first frame entering with no compensation at `passStart`. */
export function laneCycle(
  planned: readonly StudioPlanned[],
  passStart: number,
): StudioScheduled[] {
  return planned
    .map(({ segment, base }) => ({ segment, when: passStart + base }))
    .sort((a, b) => a.when - b.when)
}

/** A pass from `fromFrame`: what ends before it is skipped, what spans it starts part-way. */
export function passFrom(
  cycle: readonly StudioScheduled[],
  fromFrame: number,
): StudioScheduled[] {
  return cycle
    .flatMap((item) => {
      if (segmentEnd(item.segment) <= fromFrame) return []
      const skipped = Math.max(0, fromFrame - item.segment.startFrame)
      return [
        {
          when: item.when + skipped / STUDIO_SAMPLE_RATE,
          segment: {
            ...item.segment,
            startFrame: item.segment.startFrame + skipped,
            sourceInFrame: item.segment.sourceInFrame + skipped,
          },
        },
      ]
    })
    .sort((a, b) => a.when - b.when)
}

/**
 * A lane's timeline from `fromFrame` in `pass`. The cycle is timed for pass
 * 0, whose first frame enters at `passStart`; the pass scheduled first is
 * the cycle shifted by `pass` loops of `cycleSeconds`, from `fromFrame`.
 */
export function laneTimeline(
  planned: readonly StudioPlanned[],
  passStart: number,
  fromFrame: number,
  pass = 0,
  cycleSeconds = 0,
): StudioLaneTimeline {
  const cycle = laneCycle(planned, passStart)
  const shift = pass * cycleSeconds
  return {
    cycle,
    scheduled: passFrom(
      cycle.map((item) => ({ ...item, when: item.when + shift })),
      fromFrame,
    ),
    next: 0,
    pass,
  }
}

/** What a segment sounds like, everything but which clips it came from. */
function segmentKey(segment: StudioPlannedSegment): string {
  const { clipIds: _clipIds, ...sound } = segment
  return JSON.stringify(sound)
}

/** Whether two lanes play the same audio on the same frames: a split, or an edit to another lane. */
export function sameSegments(
  a: readonly StudioPlannedSegment[],
  b: readonly StudioPlannedSegment[],
): boolean {
  return (
    a.length === b.length &&
    a.every((segment, index) => segmentKey(segment) === segmentKey(b[index]))
  )
}

/** The segment sounding at `frame`, if any. */
function segmentAt(
  segments: readonly StudioPlannedSegment[],
  frame: number,
): StudioPlannedSegment | undefined {
  return segments.find(
    (segment) => segment.startFrame <= frame && frame < segmentEnd(segment),
  )
}

/**
 * Whether a lane crossing from `before` to `after` at `frame` crosses
 * between the same audio on the same frames, at any level, or from or to
 * silence: a linear crossfade then sums straight. False for two unrelated
 * places, a clip moved under the playhead, which cross at equal power.
 */
export function sameAudioAt(
  before: readonly StudioPlannedSegment[],
  after: readonly StudioPlannedSegment[],
  frame: number,
): boolean {
  const old = segmentAt(before, frame)
  const next = segmentAt(after, frame)
  if (!old || !next) return true
  return (
    old.assetId === next.assetId &&
    old.sourceInFrame - old.startFrame === next.sourceInFrame - next.startFrame
  )
}
