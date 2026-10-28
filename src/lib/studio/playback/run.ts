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
import type { buildStudioGraph, StudioGraph } from './graph'

/** Studio's timeline rate: frames are counted at 48 kHz on every device. */
export const STUDIO_RUN_RATE = 48000

/** Lead time for the attack when a run starts from silence. */
export const RUN_OPEN_SECONDS = 0.09

/** How far ahead of the clock a run schedules its clips. */
export const RUN_LOOKAHEAD_SECONDS = 2

/**
 * Lead time between building a run's graph and its first sound. It follows
 * how long the last build took, so a fast machine starts in about a tenth of
 * a second and a slow one still schedules ahead of its clock.
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

/** Open a run's envelope from silence at `time`: the house exponential attack. */
export function openRunEnvelope(envelope: GainNode, time: number): number {
  envelope.gain.value = 0
  envelope.gain.setValueAtTime(0.0001, time)
  envelope.gain.exponentialRampToValueAtTime(1, time + RUN_OPEN_SECONDS)
  return time + RUN_OPEN_SECONDS
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
 * Build a run's graph, envelope and meters, and open it. When a step fails,
 * what this built is freed; the audio and memory stay the caller's to free
 * until it returns.
 */
export function buildStudioRun(parts: StudioRunParts): StudioRun {
  const { ctx, plan, timing } = parts
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
      {
        metering: true,
        fromFrame: timing.fromFrame,
        repeat: parts.repeat,
        silentLanes: parts.silentLanes,
        master: { spec: parts.master },
      },
    )
    envelope = ctx.createGain()
    envelope.gain.value = 0
    graph.output.connect(envelope)
    envelope.connect(ctx.destination)
    graph.scheduleUntil(ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
    meter = createStudioLiveMeter(ctx, envelope, timing.audibleEpoch)
    laneMeter = parts.createLaneMeter(
      ctx,
      graph.laneOutputs(),
      timing.audibleEpoch,
    )
    // Last, once nothing can fail: a handoff commits the held run to fading.
    const openAt = parts.open(envelope, timing.audibleEpoch)
    return {
      ctx,
      graph,
      project: parts.project,
      sounding: new Set(
        plan.lanes
          .filter((lane) => lane.segments.length > 0)
          .map((lane) => lane.track.id),
      ),
      envelope,
      measured: parts.measured,
      meter,
      laneMeter,
      buffers: parts.buffers,
      releaseMemory: parts.releaseMemory,
      startFrame: timing.fromFrame,
      endFrame: plan.endFrame,
      firstFrame: plan.startFrame,
      audibleEpoch: timing.audibleEpoch,
      latency: parts.latency,
      openAt,
      silentUntil: parts.fromSilence ? timing.audibleEpoch : -Infinity,
      untilFrame: parts.repeat ? Infinity : plan.endFrame,
      tailFrames: plan.tailFrames,
      canLoop: plan.startFrame === 0,
    }
  } catch (error) {
    meter?.dispose()
    laneMeter?.dispose()
    graph?.dispose()
    envelope?.disconnect()
    throw error
  }
}
