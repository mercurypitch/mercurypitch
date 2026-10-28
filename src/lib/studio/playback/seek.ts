// ============================================================
// Studio seek while playing — the running graph moves its read position, as a DAW's does
// ============================================================
//
// A seek used to stop the song (a 180 ms release), build a new graph and
// fade that in: about a quarter of a second from the click to the new
// place, 40 dB down on the way. The graph already has what any frame of its
// plan needs, the plan from the song's start and that audio leased, so a
// seek now keeps the chains, master and meters, and each lane crossfades to
// sources started at the new frame (seek-crossfade.ts). Only a plan that
// does not reach the target cannot: one built from a later frame when memory
// was short, or a shorter song's that an edit is replacing. The transport
// then hands over to a run built at the target instead (handoff.ts).
import type { StudioHandoff } from './handoff'
import { crossSameFrames } from './handoff'
import type { StudioRun, StudioRunTiming } from './run'
import { RUN_LOOKAHEAD_SECONDS, runPosition } from './run'

/** Room for this thread to finish scheduling a seek before the audio thread can reach it. */
const SEEK_SCHEDULING_SECONDS = 0.005

/**
 * The soonest a seek can begin on the audio clock: past the device callback
 * the audio thread may be rendering now (baseLatency: 512 frames, 10.7 ms,
 * in desktop Chromium on Linux), and past the scheduling itself. A source
 * started in the past plays late by however far, and lanes started a
 * callback apart would stay that far apart until the next seek.
 */
export function seekEarliest(ctx: AudioContext): number {
  const callback =
    Number.isFinite(ctx.baseLatency) && ctx.baseLatency > 0
      ? ctx.baseLatency
      : 0.01
  return (
    ctx.currentTime +
    Math.max(callback, 256 / ctx.sampleRate) +
    SEEK_SCHEDULING_SECONDS
  )
}

/**
 * The runs a seek moves: each one heard from now on, so a handover under
 * way stays on one frame. A run handing over is heard until its crossfade
 * ends, and `newest` after it.
 */
function runsToSeek(
  handoffs: readonly StudioHandoff[],
  newest: StudioRun,
): StudioRun[] {
  const now = newest.ctx.currentTime
  return [
    ...handoffs.filter(({ to }) => now < to.openAt).map(({ from }) => from),
    newest,
  ]
}

/**
 * Move every run heard now, or about to be, to `frame`, heard from one
 * shared moment, so a handover between two of them stays sample-aligned.
 * False, with nothing moved, when any plan does not reach `frame`: one built
 * from a later frame because memory was short, or one of a shorter song
 * that an edit is replacing.
 */
export function seekRuns(runs: readonly StudioRun[], frame: number): boolean {
  if (
    !runs.length ||
    !runs.every((run) => frame >= run.firstFrame && frame < run.endFrame)
  )
    return false
  const ctx = runs[0].ctx
  const earliest = seekEarliest(ctx)
  // When the new frame is heard: no run's graph can bring it in sooner,
  // and a run still silent brings it in as its envelope opens, so the
  // first thing heard is the frame clicked.
  let audible = Math.max(
    ...runs.map((run) => Math.max(earliest + run.latency, run.silentUntil)),
  )
  for (const run of runs)
    audible = Math.max(
      audible,
      run.graph.seekTime(audible - run.latency) + run.latency,
    )
  for (const run of runs) {
    const at = run.graph.seekTime(audible - run.latency)
    if (run.graph.seek(frame, at) === null) continue
    run.startFrame = frame
    run.audibleEpoch = at + run.latency
    // A song that plays once ends at the end of the pass from here.
    if (run.untilFrame !== Infinity) run.untilFrame = run.endFrame
    run.graph.scheduleUntil(ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
    // The meters measure the new place from when it is heard, as a new run's do.
    run.meter?.restart(run.audibleEpoch)
    run.laneMeter?.restart(run.audibleEpoch)
  }
  return true
}

/**
 * Move every run heard from now on to `frame`, in place. False, with nothing
 * moved, when one cannot. A handover under way then joins two runs on the
 * same frames, so none of them is a seek's any more.
 */
export function seekInPlace(
  handoffs: readonly StudioHandoff[],
  newest: StudioRun,
  frame: number,
): boolean {
  if (!seekRuns(runsToSeek(handoffs, newest), frame)) return false
  for (const handoff of handoffs) {
    if (handoff.seek) crossSameFrames(handoff)
    handoff.seek = false
  }
  return true
}

/**
 * Where a run built for a seek the held run could not follow takes over: at
 * the target, as soon as it is built and the held run's envelope is fully
 * open, as a handover needs. The top once the song ends there.
 */
export function seekTiming(
  held: StudioRun,
  endFrame: number,
  frame: number,
  earliest: number,
): StudioRunTiming {
  return {
    fromFrame: frame >= endFrame ? 0 : frame,
    audibleEpoch: Math.max(earliest, held.openAt),
  }
}

/**
 * The frame the playhead shows while `heard` plays: a seek's own, from the
 * click on, while the song still plays the frames before it, waiting for a
 * run built at `target` or handing over to one.
 */
export function seekShownFrame(
  heard: StudioRun,
  newest: StudioRun,
  handoffs: readonly StudioHandoff[],
  target: number | null,
): number {
  if (target !== null) return target
  const now = heard.ctx.currentTime
  const seeking = handoffs.some(({ seek, at }) => seek && now < at)
  return runPosition(seeking ? newest : heard)
}
