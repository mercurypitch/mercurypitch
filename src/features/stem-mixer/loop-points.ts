// ============================================================
// Loop points — where the mixer's A and B may go
// ============================================================
//
// The A–B loop, in seconds of the song. A point is null until it is set, so
// an A at exactly 0:00 is a set A, not a missing one.
//
// B goes more than LOOP_MIN_GAP after A, and A more than that before B. A
// loop shorter than the gap wraps on every frame, and the song stands still
// on A: the playhead is past B before a single frame has played. A refused
// point says why and leaves the loop as it was.
//
// B set with no A loops from the start of the song, so A is set to 0:00 with
// it: the loop on screen is the loop that plays. The canvas marker drag keeps
// the same gap (useStemMixerCanvasController).
//
// Which A and B make a loop is one rule, `hasPlayableLoop`, kept with the gap
// in lib/loop-gap.ts, where the components that draw the switches can reach
// it: the Loop button, the L key, the phone's loop switch, the voice commands
// and the playback clock all ask it, so none of them turns on a loop another
// would not play.

import { hasPlayableLoop, LOOP_GAP_SLACK, LOOP_MIN_GAP } from '@/lib/loop-gap'

// Defined with the rule; callers in this feature import it from here.
export { LOOP_MIN_GAP }

export interface LoopPoints {
  start: number | null
  end: number | null
}

export type LoopPointPlacement =
  | { placed: true; points: LoopPoints }
  | { placed: false; reason: string }

export function placeLoopPoint(
  which: 'A' | 'B',
  time: number,
  points: LoopPoints,
): LoopPointPlacement {
  const at = Math.max(0, time)
  if (which === 'A') {
    if (
      points.end !== null &&
      points.end - at <= LOOP_MIN_GAP + LOOP_GAP_SLACK
    ) {
      return {
        placed: false,
        reason:
          'The loop start (A) has to be at least 0.1 s before its end (B).',
      }
    }
    return { placed: true, points: { start: at, end: points.end } }
  }
  const start = points.start ?? 0
  if (at - start <= LOOP_MIN_GAP + LOOP_GAP_SLACK) {
    return {
      placed: false,
      reason: 'The loop end (B) has to be at least 0.1 s after its start (A).',
    }
  }
  return { placed: true, points: { start, end: at } }
}

/**
 * The span the playback clock wraps in: A (or the song's start) to B (or the
 * song's end). Null while the loop is off, and for a span too short to play,
 * which is played straight through instead of held on A.
 */
export function loopSpan(
  enabled: boolean,
  points: LoopPoints,
  duration: number,
): { start: number; end: number } | null {
  if (!enabled) return null
  const start = points.start ?? 0
  const end = points.end ?? duration
  return hasPlayableLoop(start, end) ? { start, end } : null
}
