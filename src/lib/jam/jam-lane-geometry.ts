// ── Jam lane geometry ────────────────────────────────────────────────
// Where a second of the song lands on a peer lane, in pixels.
//
// Lives apart from JamPeerLanes because the lane's one hard invariant --
// the reference note under the playhead is the note being sung RIGHT NOW
// -- is arithmetic, and arithmetic hidden inside a requestAnimationFrame
// draw call is arithmetic nobody can assert on. It shipped wrong: the
// window was built as [pos - WINDOW_SEC * (1 - NOW_AT), pos + WINDOW_SEC
// * NOW_AT], which put `pos` a quarter of the way across while the
// playhead line and the live trail sat three quarters along. Every
// reference note was drawn four seconds early, and LEAD_IN_SEC being
// four seconds made the cue look right while the notes were not.
//
// The window used to be a fixed eight seconds stretched across whatever
// width there was, so a wider lane drew FATTER pills rather than more
// song. It is pixels-per-second now: the scale is the same everywhere and
// the width decides how much song fits, which is what makes zoom mean
// something and what makes dragging the split worth doing.
//
// Same shape as the karaoke zen ribbon (zen-pitch-ribbon.ts): one window,
// one ruler, everything drawn through it.

/** Pixels one song second takes at 1x zoom. */
export const BASE_PX_PER_SEC = 60

/**
 * Bounds on how much song a lane may show.
 *
 * The floor stops a narrow phone lane at high zoom from showing a single
 * syllable with no context. The ceiling is set by the history buffer: at
 * sixteen seconds the share behind the playhead is twelve, and the live
 * sample ring holds 600 frames at ~20/s, so a trail asked to reach
 * further back would simply stop in mid-air.
 */
export const LANE_WINDOW_MIN_SEC = 2.5
export const LANE_WINDOW_MAX_SEC = 16

/**
 * Where "now" sits across the lane.
 *
 * Not at the right edge: with a target line to sing, you need to see what
 * is COMING more than what has gone, so the playhead sits three quarters
 * along and the next second or two is visible ahead of it.
 */
export const NOW_AT = 0.75

/** The stretch of song a lane shows, in song seconds. */
export interface LaneWindow {
  /** The second drawn at x = 0. */
  from: number
  /** The second drawn at x = width. */
  to: number
}

/**
 * How many seconds of song fit in a lane this wide at this zoom.
 *
 * Zooming in shows LESS timeline; widening the lane (a big desktop, the
 * split dragged towards the lanes) shows MORE of it at the same scale.
 */
export function laneWindowSec(width: number, zoom: number): number {
  const px = BASE_PX_PER_SEC * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1)
  const wanted = (Number.isFinite(width) && width > 0 ? width : 1) / px
  return Math.min(LANE_WINDOW_MAX_SEC, Math.max(LANE_WINDOW_MIN_SEC, wanted))
}

/**
 * The visible stretch of song around `positionSec`.
 *
 * NOW_AT is a fraction of the LANE, so it is the share of the window
 * behind the playhead -- six seconds gone, two to come. Reading it as the
 * share ahead is the bug this module exists to keep out.
 */
export function laneWindow(positionSec: number, windowSec: number): LaneWindow {
  return {
    from: positionSec - windowSec * NOW_AT,
    to: positionSec + windowSec * (1 - NOW_AT),
  }
}

/** A song second as an x-pixel, given where the song is and how wide the lane is. */
export function laneSecToX(
  timeSec: number,
  positionSec: number,
  width: number,
  windowSec: number,
): number {
  return (
    ((timeSec - laneWindow(positionSec, windowSec).from) / windowSec) * width
  )
}

/**
 * A live pitch sample as an x-pixel, from its age in wall-clock
 * milliseconds.
 *
 * Trails are placed by age rather than by song time because they are
 * measured here and now, while the notes are pinned to the recording. The
 * two must still share a ruler: a sample taken `age` ago has to land
 * exactly where `laneSecToX` puts the song second `age` ago, or the
 * singer's line and the line they are aiming at drift apart.
 */
export function liveSampleX(
  ageMs: number,
  width: number,
  windowSec: number,
): number {
  return width * NOW_AT - (ageMs / (windowSec * 1000)) * width
}
