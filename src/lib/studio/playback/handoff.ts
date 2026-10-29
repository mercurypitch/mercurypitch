// ============================================================
// Studio run handoff — a new run takes over a playing one on the same frame, with a 30 ms crossfade
// ============================================================
//
// An edit that needs a new graph (an effect list the running graph cannot
// swap in, lane-swap.ts, or a clip edit it cannot re-plan, lane-replan.ts)
// used to fade the song out, build, and fade it back in: about 170 ms of
// silence, and the song came back late by that much. A handoff keeps the playing run sounding while the
// next one is built, starts the next one on the frame the playing run
// reaches at that moment, and crossfades the two linearly. What both runs
// play is the same audio on the same frames, so the linear sum stays flat;
// only what the edit changed is heard to change.
//
// Linear is right here and only here: the crossfade sits inside continuous
// material (.claude/memory/audio-pop-free-playback.md). A start from silence
// keeps the exponential attack, and a stop keeps the setTargetAtTime release.
//
// A seek the playing run cannot follow is the exception: it hands over to a
// run built at the target, so the two sides are different places in the
// song, unrelated, and their powers add. That crossfade is equal-power, as a
// seek in place is (seek-crossfade.ts): a linear pair sags 3 dB halfway.
import type { StudioRun, StudioRunTiming } from './run'
import { runTimelineFrame, STUDIO_RUN_RATE } from './run'

export const HANDOFF_SECONDS = 0.03
/** A handover this close is left to happen: taking it back could catch its crossfade begun. */
export const HANDOFF_CANCEL_MARGIN_SECONDS = 0.05
/**
 * Straight segments in an equal-power crossfade. Each sags under the curve
 * by cos²(π/32), 0.04 dB at most, and every segment ends on it.
 */
const POWER_SEGMENTS = 8

/** A run taking over: `from` is heard until `at`, then crossfades to `to`. */
export interface StudioHandoff {
  readonly from: StudioRun
  readonly to: StudioRun
  readonly at: number
  /** `to` starts where a seek asked, not on the frame `from` plays then. */
  seek: boolean
}

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

/** Every run heard or about to be: those handing over, then each of `newest` there is. */
export function liveRunsOf(
  handoffs: readonly StudioHandoff[],
  ...newest: (StudioRun | null)[]
): StudioRun[] {
  return [
    ...handoffs.map(({ from }) => from),
    ...newest.filter((run): run is StudioRun => run !== null),
  ]
}

/** Which of `newest` and the runs handing over to it is heard now: the newest whose handover has begun. */
export function heardRun(
  handoffs: readonly StudioHandoff[],
  newest: StudioRun | null,
): StudioRun | null {
  if (!newest) return null
  const now = newest.ctx.currentTime
  return handoffs.find(({ at }) => now < at)?.from ?? newest
}

/** The crossfade from `time`: linear, or equal-power for two unrelated places. */
function crossfade(
  held: GainNode,
  next: GainNode,
  time: number,
  unrelated: boolean,
): void {
  const segments = unrelated ? POWER_SEGMENTS : 1
  for (let segment = 1; segment <= segments; segment++) {
    const [out, into] = crossfadeGains(segment / segments, unrelated)
    const at = time + (HANDOFF_SECONDS * segment) / segments
    held.gain.linearRampToValueAtTime(out, at)
    next.gain.linearRampToValueAtTime(into, at)
  }
}

/** The held and next gains `share` of the way through a crossfade. */
function crossfadeGains(share: number, unrelated: boolean): [number, number] {
  if (share >= 1) return [0, 1]
  if (!unrelated) return [1 - share, share]
  const angle = (Math.PI / 2) * share
  return [Math.cos(angle), Math.sin(angle)]
}

/**
 * Crossfade from the held run's envelope to the next one's at `time`. The
 * held envelope is fully open by then (handoffTiming waits for it), and
 * nothing is scheduled on it after `time`, so the ramps simply append.
 * `unrelated` when the next run plays another place: a seek's.
 */
export function scheduleHandoff(
  held: GainNode,
  next: GainNode,
  time: number,
  unrelated = false,
): number {
  held.gain.setValueAtTime(1, time)
  next.gain.value = 0
  next.gain.setValueAtTime(0, time)
  crossfade(held, next, time, unrelated)
  return time + HANDOFF_SECONDS
}

/**
 * Take back a crossfade that has not begun, so the held envelope stays open.
 * Only the fade is cancelled, from before the first point it draws:
 * cancelling at `time` itself would also drop an attack that ends there and
 * close the envelope. The hold at `time` stays, so the next handoff from
 * this envelope starts at `time` or later.
 */
export function cancelHandoff(held: GainNode, time: number): void {
  held.gain.cancelScheduledValues(time + HANDOFF_SECONDS / POWER_SEGMENTS / 2)
}

/**
 * A seek's handover whose two runs a later seek in place has put on the
 * same frames crosses linearly after all, as an edit's does: equal power
 * over the same audio would swell 3 dB halfway. Left alone once it is too
 * close to change, or when it begins before the two runs meet.
 */
export function crossSameFrames({ from, to, at }: StudioHandoff): void {
  const now = from.ctx.currentTime
  if (at - now < HANDOFF_CANCEL_MARGIN_SECONDS || at < from.audibleEpoch) return
  cancelHandoff(from.envelope, at)
  cancelHandoff(to.envelope, at)
  crossfade(from.envelope, to.envelope, at, false)
}
