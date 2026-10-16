// ============================================================
// Loop gap — the shortest loop, and which A and B make one
// ============================================================
//
// The stem mixer's A and B are seconds of the song. A loop shorter than the
// gap wraps on every frame, and the song stands still on A: the playhead is
// past B before a single frame has played. Whether A and B make a loop is one
// rule, `hasPlayableLoop`: the Loop button, the L key, the phone's loop
// switch, the voice commands and the playback clock all ask it, so none of
// them turns on a loop another would not play.
//
// The rule sits here, under both the stem mixer's feature code and the
// components that draw its switches, because a component may not import a
// feature. Where A and B may go is features/stem-mixer/loop-points.ts.

/** The least time between A and B, in seconds. */
export const LOOP_MIN_GAP = 0.1

/** Floating-point slack, so a point exactly the gap away reads as exactly it. */
export const LOOP_GAP_SLACK = 1e-9

/**
 * Whether A and B make a loop that can be turned on, and that the clock plays
 * once it is: B is set and at least the gap after A. B alone loops from 0:00.
 * A alone would loop from A to the song's end, which the singer did not set,
 * so the switches wait for B.
 */
export function hasPlayableLoop(
  start: number | null,
  end: number | null,
): boolean {
  return end !== null && end - (start ?? 0) >= LOOP_MIN_GAP - LOOP_GAP_SLACK
}
