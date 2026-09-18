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
// Same shape as the karaoke zen ribbon (zen-pitch-ribbon.ts): one window,
// one ruler, everything drawn through it.

/** Seconds of history a lane shows. Long enough to see a phrase. */
export const WINDOW_SEC = 8

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
 * The visible stretch of song around `positionSec`.
 *
 * NOW_AT is a fraction of the LANE, so it is the share of the window
 * behind the playhead -- six seconds gone, two to come. Reading it as the
 * share ahead is the bug this module exists to keep out.
 */
export function laneWindow(positionSec: number): LaneWindow {
  return {
    from: positionSec - WINDOW_SEC * NOW_AT,
    to: positionSec + WINDOW_SEC * (1 - NOW_AT),
  }
}

/** A song second as an x-pixel, given where the song is and how wide the lane is. */
export function laneSecToX(
  timeSec: number,
  positionSec: number,
  width: number,
): number {
  return ((timeSec - laneWindow(positionSec).from) / WINDOW_SEC) * width
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
export function liveSampleX(ageMs: number, width: number): number {
  return width * NOW_AT - (ageMs / (WINDOW_SEC * 1000)) * width
}
