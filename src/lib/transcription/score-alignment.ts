// ============================================================
// Score alignment — a written score on a recording's clock
// ============================================================
//
// A tab and a recording of the same song do not share a clock, and the gap is
// not a constant. Dance of Death's own MIDI export runs 528 s against a 517 s
// recording: about two percent long, which is eleven seconds of drift by the
// end. One offset cannot fit that. Nudging the whole tab until the first note
// lines up puts the last chorus a bar and a half out.
//
// So an alignment is a list of anchors — moments the two clocks are known to
// be the same instant — and the map between them is the line through those
// anchors. This is what Songsterr does to hang a Guitar Pro tab on a YouTube
// video, and it is what the Lab's windowed matcher has been computing all
// along without anyone being able to reuse it.
//
// Anchors can come from measurement (the matcher aligns each six-second window
// against the score and reports where it landed) or from a person dragging the
// tab until it fits. The two are kept apart because they deserve different
// treatment: a measured alignment can be thrown away and measured again, a
// manual one is somebody's work and must not be silently overwritten.

/** One moment the score and the recording are known to be the same instant. */
export interface ScoreAlignmentAnchor {
  /** Seconds into the score's own timeline. */
  scoreSeconds: number
  /** Seconds into the recording. */
  audioSeconds: number
}

export interface ScoreAlignment {
  /** In audio order, strictly increasing on both clocks. */
  anchors: readonly ScoreAlignmentAnchor[]
  /**
   * Measured alignments are re-derived whenever the transcription changes;
   * manual ones are only ever changed by the person who made them.
   */
  source: 'measured' | 'manual'
}

/** No anchors at all: the two clocks are taken to be the same clock. */
export const IDENTITY_ALIGNMENT: ScoreAlignment = {
  anchors: [],
  source: 'measured',
}

/**
 * Two anchors closer together than this on either clock are one anchor.
 *
 * Windowed measurement can report the same instant twice when a window is
 * skipped or a resync lands on a boundary, and two anchors at the same time
 * make the segment between them vertical — a division by zero that would send
 * every later lookup to infinity.
 */
const MIN_ANCHOR_GAP_SECONDS = 1e-3

/**
 * Anchors in audio order, with everything unusable removed.
 *
 * Anchors must increase on BOTH clocks. A pair that goes forward in the
 * recording but backward in the score would draw the tab running backwards for
 * a moment, which is never a real measurement — it is an aliased window that
 * matched the wrong repeat of a riff. Dropping it is the honest response;
 * keeping it and clamping would hide a bad measurement behind a plausible
 * picture.
 */
export function normalizeAlignment(alignment: ScoreAlignment): ScoreAlignment {
  const usable = alignment.anchors
    .filter(
      (anchor) =>
        Number.isFinite(anchor.scoreSeconds) &&
        Number.isFinite(anchor.audioSeconds),
    )
    .sort((left, right) => left.audioSeconds - right.audioSeconds)

  const anchors: ScoreAlignmentAnchor[] = []
  for (const anchor of usable) {
    const previous = anchors.at(-1)
    if (previous === undefined) {
      anchors.push(anchor)
      continue
    }
    if (
      anchor.audioSeconds - previous.audioSeconds < MIN_ANCHOR_GAP_SECONDS ||
      anchor.scoreSeconds - previous.scoreSeconds < MIN_ANCHOR_GAP_SECONDS
    ) {
      continue
    }
    anchors.push(anchor)
  }

  return { anchors, source: alignment.source }
}

/**
 * The windowed matcher's output, as anchors.
 *
 * `startSeconds` is where a window opened on the recording and `offsetSeconds`
 * is how far the score sits ahead of it there, so the same instant is
 * `startSeconds` on one clock and `startSeconds + offsetSeconds` on the other.
 */
export function alignmentFromWindowOffsets(
  offsets: readonly { startSeconds: number; offsetSeconds: number }[],
): ScoreAlignment {
  return normalizeAlignment({
    source: 'measured',
    anchors: offsets.map((offset) => ({
      audioSeconds: offset.startSeconds,
      scoreSeconds: offset.startSeconds + offset.offsetSeconds,
    })),
  })
}

/** An alignment holding one constant offset, which is the manual nudge case. */
export function constantAlignment(
  offsetSeconds: number,
  source: ScoreAlignment['source'] = 'manual',
): ScoreAlignment {
  const safe = Number.isFinite(offsetSeconds) ? offsetSeconds : 0
  return {
    source,
    anchors: [
      { audioSeconds: 0, scoreSeconds: safe },
      { audioSeconds: 1, scoreSeconds: safe + 1 },
    ],
  }
}

/**
 * Slide the whole alignment along the recording.
 *
 * The knob a person reaches for when the tab is right but late. Every anchor
 * moves together, so a measured drift survives the nudge instead of being
 * flattened by it — and the result is marked manual, because it is now
 * somebody's decision rather than a measurement.
 */
export function nudgeAlignment(
  alignment: ScoreAlignment,
  deltaSeconds: number,
): ScoreAlignment {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) {
    return { ...alignment, source: 'manual' }
  }
  return {
    source: 'manual',
    anchors: alignment.anchors.map((anchor) => ({
      scoreSeconds: anchor.scoreSeconds,
      audioSeconds: anchor.audioSeconds + deltaSeconds,
    })),
  }
}

/**
 * Convert between the clocks: the line through the anchors, extended at both
 * ends by the slope of the nearest segment.
 *
 * The ends are extended by slope rather than held flat because the thing being
 * corrected IS a rate difference — a score exported a couple of percent long
 * drifts steadily, and freezing the offset past the last anchor reintroduces
 * exactly the error the anchors exist to remove. With a single anchor there is
 * no slope to extend, so it becomes a constant shift, which is all one point
 * can honestly claim.
 *
 * Returns a function rather than converting one time at a time: a view asks
 * this for every note it draws, and the segment search is a binary search over
 * anchors that would otherwise be rebuilt per call.
 */
function createClock(
  anchors: readonly ScoreAlignmentAnchor[],
  from: 'audioSeconds' | 'scoreSeconds',
  to: 'audioSeconds' | 'scoreSeconds',
): (seconds: number) => number {
  if (anchors.length === 0) return (seconds) => seconds
  if (anchors.length === 1) {
    const shift = anchors[0][to] - anchors[0][from]
    return (seconds) => (Number.isFinite(seconds) ? seconds + shift : shift)
  }

  const sourceTimes = anchors.map((anchor) => anchor[from])

  return (seconds: number): number => {
    if (!Number.isFinite(seconds)) return anchors[0][to]

    // The segment whose start is the last one at or before `seconds`, clamped
    // to a real segment so both ends extrapolate rather than clamping flat.
    let low = 0
    let high = anchors.length - 2
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (sourceTimes[mid] <= seconds) low = mid
      else high = mid - 1
    }

    // The span cannot be zero: normalization is what guarantees a real gap
    // between adjacent anchors on both clocks, which is the whole reason the
    // clocks are only built from normalized anchors.
    const start = anchors[low]
    const end = anchors[low + 1]
    const slope = (end[to] - start[to]) / (end[from] - start[from])
    return start[to] + (seconds - start[from]) * slope
  }
}

/** Where a moment in the score falls in the recording. */
export function createScoreToAudioClock(
  alignment: ScoreAlignment,
): (scoreSeconds: number) => number {
  return createClock(
    normalizeAlignment(alignment).anchors,
    'scoreSeconds',
    'audioSeconds',
  )
}

/** Where a moment in the recording falls in the score. */
export function createAudioToScoreClock(
  alignment: ScoreAlignment,
): (audioSeconds: number) => number {
  return createClock(
    normalizeAlignment(alignment).anchors,
    'audioSeconds',
    'scoreSeconds',
  )
}

/**
 * How far the score and the recording disagree across the alignment, in
 * seconds from first anchor to last.
 *
 * The number that answers "is this worth aligning at all". A tab whose drift
 * is under a beat can be nudged; one that drifts eleven seconds cannot, and a
 * surface offering a single offset slider for it is lying to the reader.
 */
export function alignmentDriftSeconds(alignment: ScoreAlignment): number {
  const { anchors } = normalizeAlignment(alignment)
  if (anchors.length < 2) return 0
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  const startOffset = first.scoreSeconds - first.audioSeconds
  const endOffset = last.scoreSeconds - last.audioSeconds
  return Math.abs(endOffset - startOffset)
}
