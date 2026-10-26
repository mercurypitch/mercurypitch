// Studio edge envelopes — one versioned musical de-click policy for live and offline graphs.
import type { StudioPlannedSegment } from '../model/arrangement-plan'
import { studioClipGainAtSourceFrame } from '../model/arrangement-plan'

export const STUDIO_EDGE_POLICY_VERSION = 'studio-edges-3ms-v1'
export const STUDIO_EDGE_FRAMES = 144
const CURVE_POINTS = 65

function rise(value: number): number {
  const x = Math.max(0, Math.min(1, value))
  return (1 - Math.cos(Math.PI * x)) / 2
}

/** Group edges are original arrangement bounds, never seek or scheduler boundaries. */
export function studioSegmentGain(
  segment: StudioPlannedSegment,
  timelineFrame: number,
): number {
  const width = Math.min(
    STUDIO_EDGE_FRAMES,
    (segment.groupEndFrame - segment.groupStartFrame) / 2,
  )
  const safety = Math.min(
    rise((timelineFrame - segment.groupStartFrame) / width),
    rise((segment.groupEndFrame - timelineFrame) / width),
  )
  const sourceFrame = segment.sourceInFrame + timelineFrame - segment.startFrame
  const explicit = studioClipGainAtSourceFrame(
    { gainDb: 0, fades: segment.fades },
    sourceFrame,
  )
  return (
    Math.pow(10, (segment.gainDb + segment.preparationGainDb) / 20) *
    Math.min(explicit, safety)
  )
}

/** A small fixed curve per changing interval; flat minutes allocate no long envelope. */
export function scheduleStudioSegmentGain(
  param: AudioParam,
  segment: StudioPlannedSegment,
  when: number,
): void {
  const start = segment.startFrame
  const end = start + segment.sourceOutFrame - segment.sourceInFrame
  const width = Math.min(
    STUDIO_EDGE_FRAMES,
    (segment.groupEndFrame - segment.groupStartFrame) / 2,
  )
  const points = [
    start,
    end,
    segment.groupStartFrame + width,
    segment.groupEndFrame - width,
  ]
  for (const fade of [segment.fades.in, segment.fades.out]) {
    if (!fade) continue
    points.push(
      start + fade.fromSourceFrame - segment.sourceInFrame,
      start + fade.toSourceFrame - segment.sourceInFrame,
    )
  }
  const boundaries = [
    ...new Set(points.filter((point) => point >= start && point <= end)),
  ].sort((a, b) => a - b)
  param.setValueAtTime(studioSegmentGain(segment, start), when)
  for (let i = 1; i < boundaries.length; i++) {
    const from = boundaries[i - 1]
    const to = boundaries[i]
    const first = studioSegmentGain(segment, from)
    const last = studioSegmentGain(segment, to)
    const middle = studioSegmentGain(segment, (from + to) / 2)
    if (first === last && first === middle) {
      param.setValueAtTime(first, when + (from - start) / 48000)
      continue
    }
    const curve = Float32Array.from({ length: CURVE_POINTS }, (_, index) =>
      studioSegmentGain(
        segment,
        from + ((to - from) * index) / (CURVE_POINTS - 1),
      ),
    )
    param.setValueCurveAtTime(
      curve,
      when + (from - start) / 48000,
      (to - from) / 48000,
    )
  }
}
