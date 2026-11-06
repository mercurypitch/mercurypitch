// ============================================================
// Studio take clock — the playhead a take moves where no song plays under it: an empty song, or past the song's end
// ============================================================
//
// A take is placed on the song by its anchor (take-timing.ts): song frame
// `frame` leaves the graph at clock time `time`, and every later frame
// follows at 48 kHz. That holds whether or not a song plays, so the
// playhead can follow the take itself. A song run shows the same frames on
// the same anchor (a run's startFrame and audibleEpoch), so the take leads
// only where the song shows none: a song with nothing to play, a song that
// played out under the take, and the tail it rings while it does.
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import { wrapLoopFrame } from '@/lib/studio/playback/loop-range'
import type { StudioTakeAnchor } from '@/lib/studio/record/take-timing'
import { takeFrameAt } from '@/lib/studio/record/take-timing'

/** A take counting in or recording: where it sits on the clock. */
export interface StudioTakeClock {
  readonly anchor: StudioTakeAnchor
  /** The range a loop take records pass after pass; null for a take that runs on. */
  readonly loop: StudioFrameRange | null
}

/**
 * The song frame a take has reached at clock time `time`: held at the
 * anchor's frame through a count-in, as a run holds its first frame, and
 * wrapped in a loop's range.
 */
export function takePlayheadFrame(
  clock: StudioTakeClock,
  time: number,
): number {
  const frame = Math.max(
    clock.anchor.frame,
    Math.floor(takeFrameAt(clock.anchor, time)),
  )
  const loop = clock.loop
  return loop === null
    ? frame
    : wrapLoopFrame(frame, loop.startFrame, loop.endFrame)
}

/**
 * Whether the take's frame `take` is where the playhead stands rather than
 * the song's `song`: always with no song playing, and past a playing song's
 * frame, which stands at its end while the song's tail rings out. A loop's
 * song plays the range again under the take, so only an empty song leaves
 * a loop take to move the playhead.
 */
export function takeLeads(
  clock: StudioTakeClock,
  take: number,
  song: number,
  songPlaying: boolean,
): boolean {
  if (!songPlaying) return true
  return clock.loop === null && take > song
}

/** Same take clock: a new object for a new chunk is not a new place. */
export function sameTakeClock(
  a: StudioTakeClock | null,
  b: StudioTakeClock | null,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    a.anchor.frame === b.anchor.frame &&
    a.anchor.time === b.anchor.time &&
    a.loop?.startFrame === b.loop?.startFrame &&
    a.loop?.endFrame === b.loop?.endFrame
  )
}
