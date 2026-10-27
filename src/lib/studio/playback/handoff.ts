// ============================================================
// Studio run handoff — a new run takes over a playing one on the same frame, with a 30 ms crossfade
// ============================================================
//
// An edit that needs a new graph (a moved, trimmed or split clip, a fade, a
// new effect list) used to fade the song out, build, and fade it back in:
// about 170 ms of silence, and the song came back late by that much. A
// handoff keeps the playing run sounding while the next one is built, starts
// the next one on the frame the playing run reaches at that moment, and
// crossfades the two linearly. What both runs play is the same audio on the
// same frames, so the linear sum stays flat; only what the edit changed is
// heard to change.
//
// Linear is right here and only here: the crossfade sits inside continuous
// material (.claude/memory/audio-pop-free-playback.md). A start from silence
// keeps the exponential attack, and a stop keeps the setTargetAtTime release.
import type { StudioRun, StudioRunTiming } from './run'
import { runTimelineFrame, STUDIO_RUN_RATE } from './run'

export const HANDOFF_SECONDS = 0.03

/**
 * Where and when a new run takes over from `held`: the first whole frame the
 * held run plays no sooner than `earliest`, and no sooner than its own
 * envelope is fully open, so the two runs agree on every frame they share.
 * A song that now ends before that frame starts again from the top, as Play
 * would. Null when the held run has played its last pass by then: the song
 * ends there.
 */
export function handoffTiming(
  held: StudioRun,
  earliest: number,
  endFrame: number,
): StudioRunTiming | null {
  const start = Math.max(earliest, held.openAt)
  // A hair under a whole frame rounds down, so float noise never costs one.
  const frame = Math.ceil(runTimelineFrame(held, start) - 1e-6)
  if (frame >= held.untilFrame) return null
  const fromFrame = frame % held.endFrame
  if (fromFrame >= endFrame) return { fromFrame: 0, audibleEpoch: start }
  return {
    fromFrame,
    audibleEpoch:
      held.audibleEpoch + (frame - held.startFrame) / STUDIO_RUN_RATE,
  }
}

/**
 * Crossfade from the held run's envelope to the next one's at `time`. The
 * held envelope is fully open by then (handoffTiming waits for it), and
 * nothing is scheduled on it after `time`, so the ramps simply append.
 */
export function scheduleHandoff(
  held: GainNode,
  next: GainNode,
  time: number,
): number {
  held.gain.setValueAtTime(1, time)
  held.gain.linearRampToValueAtTime(0, time + HANDOFF_SECONDS)
  next.gain.value = 0
  next.gain.setValueAtTime(0, time)
  next.gain.linearRampToValueAtTime(1, time + HANDOFF_SECONDS)
  return time + HANDOFF_SECONDS
}

/**
 * Take back a crossfade that has not begun, so the held envelope stays open.
 * Only the fade's end is cancelled: cancelling at `time` itself would also
 * drop an attack that ends there and close the envelope. The hold at `time`
 * stays, so the next handoff from this envelope starts at `time` or later.
 */
export function cancelHandoff(held: GainNode, time: number): void {
  held.gain.cancelScheduledValues(time + HANDOFF_SECONDS / 2)
}
