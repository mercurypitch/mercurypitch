// ============================================================
// pitch-time-axis — pure label-placement helpers for the
// PitchOverTimeCanvas axes.
// ============================================================
//
// Extracted from the canvas component so the "don't jam the axis labels on a
// narrow (mobile) canvas" logic is unit-testable without a DOM/canvas.
//
// Two problems these solve:
//   • Time axis — labels used to be absolute timestamps drawn every second, so
//     on a phone (the timeline is squeezed into ~45% of the width) they
//     collided, and they grew to 2-3 digits as a session ran (18s → 183s).
//     Now they are RELATIVE ("now", "2s", "10s"), bounded by the window, and
//     only as many as fit are drawn.
//   • Note axis — when manually zoomed in, every semitone was labelled; on a
//     short tracker that jams, so the step opens up when there is no room.

/** Smallest step from ascending `steps` whose on-screen size
 *  (`step * pxPerUnit`) is at least `minGapPx`, so adjacent labels never
 *  collide. Falls back to the coarsest step when even that is too tight. */
export function chooseLabelStep(
  pxPerUnit: number,
  minGapPx: number,
  steps: number[],
): number {
  for (const step of steps) {
    if (step * pxPerUnit >= minGapPx) return step
  }
  return steps[steps.length - 1]!
}

/** "Nice" tick steps (seconds) for the time axis. */
export const TIME_AXIS_STEPS = [1, 2, 5, 10, 15, 20, 30, 60]

/** Semitone steps for the note axis: every note, every other, minor-thirds,
 *  tritones, then whole octaves. */
export const NOTE_AXIS_STEPS = [1, 2, 3, 4, 6, 12]

export interface TimeTick {
  /** Seconds before "now" (0 = the latest sample, pinned at the right edge). */
  secondsAgo: number
  label: string
}

export interface PitchTimelineGeometry {
  /** X coordinate where the newest sample and the "now" tick land. */
  rightEdge: number
  /** Usable width between the left plot margin and `rightEdge`. */
  axisWidth: number
}

/**
 * Horizontal plot geometry for the live pitch timeline.
 *
 * Sequence drills reserve the right side for their upcoming-note ladder.
 * A single-target drill has nothing to preview, so its newest sample belongs
 * at the normal right plot margin instead of stopping halfway across.
 */
export function pitchTimelineGeometry(
  canvasWidth: number,
  reservesPreviewLane: boolean,
  marginPx = 32,
  previewPlayheadFraction = 0.45,
): PitchTimelineGeometry {
  const rightEdge = reservesPreviewLane
    ? canvasWidth * previewPlayheadFraction
    : canvasWidth - marginPx
  return {
    rightEdge,
    axisWidth: Math.max(0, rightEdge - marginPx),
  }
}

/** Map one sample onto the scrolling timeline's horizontal run window. */
export function pitchTimelineSampleX(
  sampleTime: number,
  nowTime: number,
  canvasWidth: number,
  windowSeconds: number,
  reservesPreviewLane: boolean,
  marginPx = 32,
  previewPlayheadFraction = 0.45,
): number {
  const geometry = pitchTimelineGeometry(
    canvasWidth,
    reservesPreviewLane,
    marginPx,
    previewPlayheadFraction,
  )
  if (windowSeconds <= 0) return marginPx
  const windowStart = nowTime - windowSeconds
  const pct = Math.max(
    0,
    Math.min(1, (sampleTime - windowStart) / windowSeconds),
  )
  const x = marginPx + pct * geometry.axisWidth
  return Number.isFinite(x) ? x : marginPx
}

/** Format a relative time-axis label — short and bounded ("now", "2s", "10s")
 *  instead of an ever-growing absolute clock that needs three digits and jams
 *  on a phone. */
export function formatSecondsAgo(secondsAgo: number): string {
  return secondsAgo <= 0 ? 'now' : `${secondsAgo}s`
}

/** Relative time-axis ticks for a scrolling window `windowSeconds` wide drawn
 *  across `axisWidthPx` pixels. Only as many ticks as fit with `minLabelPx`
 *  spacing are returned, "now" first. */
export function timeAxisTicks(
  axisWidthPx: number,
  windowSeconds: number,
  minLabelPx = 34,
): TimeTick[] {
  if (axisWidthPx <= 0 || windowSeconds <= 0) {
    return [{ secondsAgo: 0, label: 'now' }]
  }
  const pxPerSec = axisWidthPx / windowSeconds
  const step = chooseLabelStep(pxPerSec, minLabelPx, TIME_AXIS_STEPS)
  const ticks: TimeTick[] = []
  for (let ago = 0; ago <= windowSeconds + 1e-6; ago += step) {
    const secondsAgo = Math.round(ago)
    ticks.push({ secondsAgo, label: formatSecondsAgo(secondsAgo) })
  }
  return ticks
}

/** Semitone step for the note axis so labels stay `minGapPx` apart, given a
 *  plot area `axisHeightPx` tall spanning `octaves` octaves. */
export function noteAxisSemitoneStep(
  axisHeightPx: number,
  octaves: number,
  minGapPx = 14,
): number {
  if (axisHeightPx <= 0 || octaves <= 0) {
    return NOTE_AXIS_STEPS[NOTE_AXIS_STEPS.length - 1]!
  }
  const pxPerSemitone = axisHeightPx / (octaves * 12)
  return chooseLabelStep(pxPerSemitone, minGapPx, NOTE_AXIS_STEPS)
}
