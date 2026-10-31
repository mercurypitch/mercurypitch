// ============================================================
// Studio playback run — one built graph, where it is on the clock, and its release
// ============================================================
//
// A run is what one Play, seek or restart builds: the lane graph, its output
// envelope, its meters, and the audio and memory it holds. Its timeline is
// fixed when it is built: frame `startFrame` is heard at `audibleEpoch`, and
// every later frame follows at 48 kHz, so two runs built in step agree on
// every frame they share. That is what lets a new run take over from a
// playing one sample-aligned (see handoff.ts).
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioMasterGain } from '../export/sound-graph'
import type { createStudioLaneMeter } from '../metering/live-meter'
import { createStudioLiveMeter } from '../metering/live-meter'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import type { StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import type { buildStudioGraph, StudioGraph, StudioGraphOptions, StudioGraphQuality, } from './graph'
import type { StudioPlaybackTier } from './playback-quality'
import { livePlaybackTier, notePlayout, TIER_PROFILES, } from './playback-quality'

export { openRunEnvelope, RUN_OPEN_SECONDS } from './open-envelope'

/** Studio's timeline rate: frames are counted at 48 kHz on every device. */
export const STUDIO_RUN_RATE = 48000

/** Room for this thread to finish scheduling a seek before the audio thread can reach it. */
const SEEK_SCHEDULING_SECONDS = 0.005

/**
 * The soonest a run, a seek or a swap can begin on the audio clock: past
 * the device callback the audio thread may be rendering now (baseLatency:
 * 512 frames, 10.7 ms, in desktop Chromium on Linux), and past the
 * scheduling itself. A source started in the past plays late by however
 * far, and lanes started a callback apart would stay that far apart until
 * the next seek.
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

/** A playing run's ticks watch for underruns at its tier (playback-quality.ts). */
function liveQuality(tier: StudioPlaybackTier): StudioGraphQuality {
  return { tick: (ctx) => notePlayout(ctx, performance.now(), tier) }
}

/** How far ahead of the clock a run schedules its clips. */
export const RUN_LOOKAHEAD_SECONDS = 2

/**
 * How long a new graph renders silence before its first frame: its
 * compressors settle within this (FAST_SETTLE_SECONDS, then 20 ms more).
 */
export const RUN_SETTLE_SECONDS = 0.06

/**
 * Lead time a handover plans between building a run's graph and the frame
 * it takes over on. It follows how long the last build took, so a fast
 * machine hands over in about a tenth of a second and a slow one still
 * schedules ahead of its clock. A run from silence needs no guess: it
 * starts once it is built (startAfterBuild).
 */
export function runWarmupSeconds(buildSeconds: number): number {
  return Math.min(0.5, Math.max(0.1, buildSeconds * 2 + 0.04))
}

/** Where a run sits on the clock. */
export interface StudioRunTiming {
  /** The song frame its clips start from. */
  readonly fromFrame: number
  /** When that frame is heard. */
  readonly audibleEpoch: number
}

/** A lane's level after its fader, read on the transport's tick. */
export interface StudioLaneLevel {
  readonly trackId: string
  /** The louder channel's highest sample since the last tick, as an amplitude. */
  readonly peak: number
  /** Its compressors' and limiters' gain reduction in dB, or null without any. */
  readonly reductionDb: number | null
  /**
   * The lane meter's measurement the peak came from. A seek, or a run that
   * takes over, starts a new one from the frame it is heard.
   */
  readonly measurement: number
}

export interface StudioRun {
  ctx: AudioContext
  graph: StudioGraph
  project: StudioProject
  /** Tracks with material from where this run started. */
  sounding: ReadonlySet<string>
  envelope: GainNode
  /** The measured master gains it plays with; sound edits keep them. */
  measured: StudioMasterGain
  meter: ReturnType<typeof createStudioLiveMeter>
  laneMeter: ReturnType<typeof createStudioLaneMeter>
  buffers: StudioBufferLease
  releaseMemory: () => void
  startFrame: number
  endFrame: number
  /** Its plan's first frame: a seek can move it no earlier. */
  readonly firstFrame: number
  /** When `startFrame` is heard. */
  audibleEpoch: number
  /** Seconds from a clip's start to the speakers: lane compensation and the master's latency. */
  readonly latency: number
  /** When its envelope is fully open: a later handoff starts no sooner. */
  openAt: number
  /**
   * When its envelope starts to open from silence: nothing it plays sooner
   * is heard. -Infinity for a run that fades in over the one it takes over.
   * A run Pause kept sets it again when Play starts it (keep.ts).
   */
  silentUntil: number
  /**
   * Where the song stops, counting each pass from the song's start: the end
   * of the pass that has begun, or Infinity while it repeats.
   */
  untilFrame: number
  /** The longest chain tail among the lanes heard now. */
  tailFrames: number
  /** Its plan starts at the song's start, so it can loop there. */
  canLoop: boolean
}

/** The frame a run plays at `time`, before any wrap: fractional, and earlier than its start before it is heard. */
export function runTimelineFrame(run: StudioRun, time: number): number {
  return run.startFrame + (time - run.audibleEpoch) * STUDIO_RUN_RATE
}

/** A latency the browser reports, or none for a missing or nonsensical one. */
function reportedSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0
}

/**
 * The audio-clock time at the speakers: the render clock less the output
 * path, `outputLatency` and `baseLatency`. Read afresh on every call, since
 * the spec lets both change while the context runs (headphones plugged in, a
 * Bluetooth route). Headless Chromium reports 24 to 56 ms of output latency
 * from one read to the next, on top of 10.7 ms of base latency.
 */
export function heardTime(ctx: BaseAudioContext): number {
  const { outputLatency, baseLatency } = ctx as Partial<
    Pick<AudioContext, 'outputLatency' | 'baseLatency'>
  >
  return (
    ctx.currentTime -
    reportedSeconds(outputLatency) -
    reportedSeconds(baseLatency)
  )
}

/**
 * The song frame a run plays at `time` on the render clock: held at its
 * start until then, wrapped while it repeats. Scheduling and restarts read
 * it at the clock; what the playhead shows reads it at heardTime.
 */
export function runPosition(
  run: StudioRun,
  time = run.ctx.currentTime,
): number {
  const frame = Math.floor(
    runTimelineFrame(run, Math.max(time, run.audibleEpoch)),
  )
  return frame >= run.untilFrame ? run.endFrame : frame % run.endFrame
}

/** The song frame at the speakers now: what the playhead shows. */
export function runHeardPosition(run: StudioRun): number {
  return runPosition(run, heardTime(run.ctx))
}

/** When a run has played out, its tail included: never while it repeats. */
export function runEndsAt(run: StudioRun): number {
  return run.untilFrame === Infinity
    ? Infinity
    : run.audibleEpoch +
        (run.untilFrame - run.startFrame + run.tailFrames) / STUDIO_RUN_RATE
}

/**
 * Each lane's level after its fader since the last read: empty without a
 * lane meter, and null when it has sent nothing new since.
 */
export function readLaneLevels(run: StudioRun): StudioLaneLevel[] | null {
  if (!run.laneMeter) return []
  const peaks = run.laneMeter.read()
  if (!peaks) return null
  const { measurement } = run.laneMeter
  return [...peaks].map(([trackId, peak]) => ({
    trackId,
    peak,
    reductionDb: run.graph.readLaneReduction(trackId),
    measurement,
  }))
}

/** Free everything a run holds. It must already be silent. */
export function releaseRun(run: StudioRun): void {
  run.meter?.dispose()
  run.laneMeter?.dispose()
  run.graph.dispose()
  run.envelope.disconnect()
  run.buffers.release()
  run.releaseMemory()
}

/** What a run is built from: its admitted plan, audio and memory, and its place on the clock. */
export interface StudioRunParts {
  readonly ctx: AudioContext
  readonly project: StudioProject
  readonly plan: StudioArrangementPlan
  readonly buffers: StudioBufferLease
  readonly releaseMemory: () => void
  readonly silentLanes: boolean
  readonly master: ChainSpec
  readonly measured: StudioMasterGain
  readonly repeat: boolean
  readonly timing: StudioRunTiming
  /** Seconds from a clip's start to the speakers: lane compensation and the master's latency. */
  readonly latency: number
  readonly buildGraph: typeof buildStudioGraph
  readonly createLaneMeter: typeof createStudioLaneMeter
  /** It opens from silence, not over a run it takes over from. */
  readonly fromSilence: boolean
  /** Open the new envelope at `time` and return when it is fully open. Called last. */
  open(envelope: GainNode, time: number): number
}

/**
 * The soonest a run from silence can start: RUN_SETTLE_SECONDS out, so its
 * compressors settle on silence first, and a device callback out at least.
 * Returns the graph's epoch, when its first frame enters a lane.
 */
function soonestStart(ctx: AudioContext): number {
  return Math.max(ctx.currentTime + RUN_SETTLE_SECONDS, seekEarliest(ctx))
}

/**
 * A run from silence starts once its graph is built, not after a lead
 * guessed before the build: when the audio clock ran on through the build,
 * the graph starts that much later, never with its first frames cut.
 * Returns the graph's epoch.
 */
function startAfterBuild(
  ctx: AudioContext,
  graph: StudioGraph,
  epoch: number,
): number {
  const soonest = soonestStart(ctx)
  if (soonest <= epoch) return epoch
  graph.retime(soonest)
  return soonest
}

/**
 * Build a run's graph, envelope and meters, and open it. When a step fails,
 * what this built is freed; the audio and memory stay the caller's to free
 * until it returns.
 */
export function buildStudioRun(parts: StudioRunParts): StudioRun {
  const { ctx, plan } = parts
  const timing = parts.fromSilence
    ? {
        fromFrame: parts.timing.fromFrame,
        audibleEpoch: soonestStart(ctx) + parts.latency,
      }
    : parts.timing
  let graph: StudioGraph | undefined
  let envelope: GainNode | undefined
  let meter: StudioRun['meter'] = null
  let laneMeter: StudioRun['laneMeter'] = null
  try {
    graph = parts.buildGraph(
      ctx,
      plan,
      parts.buffers.buffers,
      timing.audibleEpoch - parts.latency,
      liveGraphOptions(parts, timing.fromFrame),
    )
    envelope = ctx.createGain()
    envelope.gain.value = 0
    graph.output.connect(envelope)
    envelope.connect(ctx.destination)
    // Fresh compressors start well down: they settle on the silence before
    // the first frame, a handover's as much as a Play's.
    graph.settle(ctx.currentTime)
    const audibleEpoch = parts.fromSilence
      ? startAfterBuild(ctx, graph, timing.audibleEpoch - parts.latency) +
        parts.latency
      : timing.audibleEpoch
    graph.scheduleUntil(ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
    meter = createStudioLiveMeter(ctx, envelope, audibleEpoch)
    laneMeter = parts.createLaneMeter(ctx, graph.laneOutputs(), audibleEpoch)
    // Last, once nothing can fail: a handoff commits the held run to fading.
    const openAt = parts.open(envelope, audibleEpoch)
    return {
      ...runOf(parts, graph, envelope),
      meter,
      laneMeter,
      startFrame: timing.fromFrame,
      audibleEpoch,
      openAt,
      silentUntil: parts.fromSilence ? audibleEpoch : -Infinity,
    }
  } catch (error) {
    meter?.dispose()
    laneMeter?.dispose()
    graph?.dispose()
    envelope?.disconnect()
    throw error
  }
}

/** What a parked run is built from (prebuilt-run.ts): a run's parts, with no place on the clock yet. */
export type StudioParkedRunParts = Omit<
  StudioRunParts,
  'timing' | 'createLaneMeter' | 'fromSilence' | 'open'
>

/**
 * Build a run's graph and envelope and park them, unheard: no source is
 * scheduled and the envelope stays closed, but it feeds the speakers, so
 * the graph's fresh compressors settle on the silence it renders, as a
 * run from silence does before its first frame (soonestStart). Returns the
 * run and when they have settled. Play starts it as it starts a kept run.
 */
export function buildParkedStudioRun(parts: StudioParkedRunParts): {
  run: StudioRun
  settledAt: number
} {
  const { ctx, plan } = parts
  let graph: StudioGraph | undefined
  let envelope: GainNode | undefined
  try {
    const now = ctx.currentTime
    graph = parts.buildGraph(
      ctx,
      plan,
      parts.buffers.buffers,
      now,
      liveGraphOptions(parts, plan.startFrame),
    )
    envelope = ctx.createGain()
    envelope.gain.value = 0
    graph.output.connect(envelope)
    envelope.connect(ctx.destination)
    graph.settle(now)
    graph.park()
    return {
      run: {
        ...runOf(parts, graph, envelope),
        meter: null,
        laneMeter: null,
        startFrame: plan.startFrame,
        audibleEpoch: now,
        openAt: now,
        silentUntil: Infinity,
      },
      settledAt: now + RUN_SETTLE_SECONDS,
    }
  } catch (error) {
    graph?.dispose()
    envelope?.disconnect()
    throw error
  }
}

/** A live run's graph options: metered, at the song's playback tier (playback-quality.ts). */
function liveGraphOptions(
  parts: StudioParkedRunParts,
  fromFrame: number,
): StudioGraphOptions {
  const tier = livePlaybackTier(parts.project)
  return {
    metering: true,
    fromFrame,
    repeat: parts.repeat,
    silentLanes: parts.silentLanes,
    master: { spec: parts.master },
    profile: TIER_PROFILES[tier],
    quality: liveQuality(tier),
  }
}

/** What a run holds whatever its place on the clock. */
function runOf(
  parts: StudioParkedRunParts,
  graph: StudioGraph,
  envelope: GainNode,
) {
  const { plan } = parts
  return {
    ctx: parts.ctx,
    graph,
    project: parts.project,
    sounding: new Set(
      plan.lanes
        .filter((lane) => lane.segments.length > 0)
        .map((lane) => lane.track.id),
    ),
    envelope,
    measured: parts.measured,
    buffers: parts.buffers,
    releaseMemory: parts.releaseMemory,
    endFrame: plan.endFrame,
    firstFrame: plan.startFrame,
    latency: parts.latency,
    untilFrame: parts.repeat ? Infinity : plan.endFrame,
    tailFrames: plan.tailFrames,
    canLoop: plan.startFrame === 0,
  }
}
