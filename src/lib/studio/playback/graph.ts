// ============================================================
// Studio graph — one persistent chain per lane, each lane's sources on a timeline of its own, for live playback and offline renders
// ============================================================
//
// The graph builds each lane's chain and faders once, and the master after
// them. What a lane plays comes and goes in sets of sources (seek-crossfade.ts)
// on that lane's own timeline (lane-timeline.ts), all timed from one shared
// anchor (graph-passes.ts). So a seek crosses every lane to a new place, a
// clip edit crosses only the lanes it changes (graph-replan.ts), and neither
// touches a chain, a fader or a meter. A new effect list builds only its
// lane's new chain, beside the old one, and crosses the lane to it
// (graph-swap.ts). An offline render builds the same graph and schedules it
// once, so a render and Play agree on every lane.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import type { StudioArrangementPlan, StudioPlannedLane, } from '../model/arrangement-plan'
import type { StudioTrack } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioGraphLane } from './graph-lanes'
import { buildGraphLane, disposeGraphLane, dynamicsIds, mixLane, scheduleLane, silenceLane, } from './graph-lanes'
import type { StudioGraphState } from './graph-passes'
import { canLoop, laneRun, MIN_LOOP_SECONDS, repeatLanes, restartLanes, seekTime, stopRepeatingLanes, swapping, } from './graph-passes'
import type { StudioReplan } from './graph-replan'
import { replanGraph } from './graph-replan'
import type { StudioReverbBuses } from './graph-reverb-bus'
import { createReverbBuses, retrimLaneSends, sendTrim, } from './graph-reverb-bus'
import type { StudioChainSwap } from './graph-swap'
import { finishSwaps, laneCrossing, settleSwaps, swapChains, } from './graph-swap'
import { quietLane, settleIdleLanes, wakeLane } from './lane-idle'

export type { StudioReplan } from './graph-replan'
export type { StudioChainSwap } from './graph-swap'

export interface StudioGraph {
  readonly output: GainNode
  scheduleUntil(time: number): void
  /**
   * When a seek asked for no sooner than `earliest` would start: then, or
   * at the newest seek's or re-plan's own time while that one is not heard
   * yet, since a newer seek takes its place there.
   */
  seekTime(earliest: number): number
  /**
   * Play from `fromFrame` instead, crossfading each lane from its sources to
   * the new ones (seek-crossfade.ts); the chains, master and meters play on.
   * The frame enters a lane with no compensation at the returned time:
   * seekTime(at), so pass a time from seekTime to keep two graphs in step.
   * Null when the plan starts after `fromFrame` or ends before it, the
   * graph is parked, or a lane is still crossing to a new chain. Call
   * scheduleUntil after it, as the new sources start at once.
   */
  seek(fromFrame: number, at: number): number | null
  /**
   * Play `plan`'s clips: each lane whose segments it changes crossfades to
   * them from the first whole frame no sooner than `earliest`, and every
   * other lane plays on untouched (graph-replan.ts). `plan` comes from the
   * same first frame as the graph's, and its latencies are not read: the
   * chains stay as they are. A parked graph takes the new segments for
   * resume. Null, with nothing changed, when the graph cannot play `plan`.
   * Call scheduleUntil after it.
   */
  replan(plan: StudioArrangementPlan, earliest: number): StudioReplan | null
  /**
   * Build a new chain for each lane `swaps` names, beside the one it plays,
   * and cross the lane to it at the chain outputs (graph-swap.ts): its
   * sources go to the new chain from the first whole frame no sooner than
   * `earliest`, and the new chain is heard from the returned time, a
   * settling time after it is built. Every other lane plays on untouched.
   * Null, with nothing changed, when the graph cannot: parked, played out,
   * a lane it did not build, a chain slower than its slowest lane, or a swap
   * still crossing. Each swap's release is called when its chain goes. Call
   * scheduleUntil after it.
   */
  swapChains(swaps: readonly StudioChainSwap[], earliest: number): number | null
  /** Whether a lane is still crossing to a new chain: until then the graph seeks, re-plans and swaps nothing. */
  swapping(): boolean
  /**
   * Stop every source now, playing or waiting, and schedule nothing more.
   * The chains, master and faders stay built, silent, for resume. The peak
   * analysers let go of the output: an analyser pulls what feeds it on
   * every render quantum, so it would keep the chains processing silence.
   * Call it once the run's envelope has closed.
   */
  park(): void
  /**
   * Play again after park from `fromFrame`, which enters a lane with no
   * compensation at `epoch`, looping when `repeat`. Its sources play at full
   * level from their first frame, since the run's envelope opens over them.
   * False, still parked, when the plan does not reach the frame or cannot
   * loop. Call scheduleUntil after it.
   */
  resume(fromFrame: number, epoch: number, repeat: boolean): boolean
  /** Settle every new compressor in the graph from `at` (effect-shell.ts `settleRelease`). */
  settle(at: number): void
  /** The profile its lane chains run (fx-profile.ts). */
  profile(): StudioFxProfile
  /**
   * Start a graph built but not scheduled yet at `epoch` instead: its first
   * frame enters a lane with no compensation then. Call scheduleUntil after it.
   */
  retime(epoch: number): void
  readPeaks(): readonly [number, number]
  /**
   * Whether this track has a lane here. Playback builds every lane with
   * clips, silent ones at zero gain; a render builds only what it hears.
   */
  hasLane(trackId: string): boolean
  /**
   * Glide a built lane's volume and pan, or silence it, while it plays. A
   * lane crossing to a new chain keeps its old balance until the new chain
   * is heard.
   */
  setLaneMix(track: StudioTrack, audible: boolean): void
  /**
   * Move a built lane's chain to new settings while it plays. The chain sends
   * only the values that changed, and each one glides (StudioFxChain.setSpec).
   */
  setLaneSpec(trackId: string, spec: ChainSpec): void
  /** The same for the master chain, when the graph has one. */
  setMasterSpec(spec: ChainSpec): void
  /** Each built lane's output after its fader and pan, for a level meter to tap. */
  laneOutputs(): ReadonlyMap<string, AudioNode>
  /**
   * The gain reduction of a lane's enabled compressors and limiters, in dB
   * (zero or below, summed: they run in series), or null when it has none.
   */
  readLaneReduction(trackId: string): number | null
  /**
   * Loop back to the song's start when the pass that is playing ends. False
   * when that loop point has already gone by, or the song is too short.
   */
  repeat(): boolean
  /**
   * Stop looping: the pass that has begun is the last, and a pass queued
   * ahead of it never plays. Returns the last pass; the first is 0.
   */
  stopRepeating(): number
  dispose(): void
}

export interface StudioGraphOptions {
  /** Read the output's peaks, as live playback does. */
  readonly metering?: boolean
  /** Where the first pass starts, in a plan compiled from the song's start. */
  readonly fromFrame?: number
  /** Loop from the plan's start after each pass; `repeat` and `stopRepeating` change it while playing. */
  readonly repeat?: boolean
  /**
   * Build the lanes that are silent now too, at zero gain, so Mute and Solo
   * bring them in while the song plays. Their latencies must be measured.
   */
  readonly silentLanes?: boolean
  readonly master?: { readonly spec: ChainSpec }
  /**
   * How much work the lane chains do (fx-profile.ts); full quality when
   * absent. The master always runs at full quality.
   */
  readonly profile?: StudioFxProfile
  /**
   * Live playback's quality (playback-quality.ts), told of every schedule
   * tick while the graph plays, to watch for underruns. A graph keeps the
   * profile it was built with; a new tier takes the next run.
   */
  readonly quality?: StudioGraphQuality
}

/** What a playing graph tells live playback quality. */
export interface StudioGraphQuality {
  /** A tick while playing, for underrun watching. */
  tick(ctx: BaseAudioContext): void
}

const PEAK_SAMPLES = 4096

/** The lanes a graph builds: those with clips, and only the audible ones unless silent lanes are wanted. */
export function studioGraphLanes(
  plan: StudioArrangementPlan,
  silentLanes = false,
): StudioPlannedLane[] {
  return plan.lanes.filter(
    (lane) => lane.segments.length > 0 && (silentLanes || lane.audible),
  )
}

/** What one effect holds at `rate`: its delay lines and node overhead. */
const effectBytes = (rate: number) => rate * 2 * 8 + 128 * 1024

export function studioGraphWorkingBytes(
  plan: StudioArrangementPlan,
  rate: number,
  masterSpec?: ChainSpec,
  silentLanes = false,
): number {
  const count = studioGraphLanes(plan, silentLanes).reduce(
    (sum, lane) => sum + lane.spec.effects.length,
    masterSpec?.effects.length ?? 0,
  )
  // Includes the engine's bounded eight-impulse cache, generation copies,
  // delay lines and node overhead. Browser-private native allocations vary.
  return Math.ceil(8 * rate * 8 * 4 * 2 * 2 + count * effectBytes(rate))
}

/** What a chain a swap builds beside a graph's needs: its effects, the graph's impulse cache already counted. */
export function studioChainWorkingBytes(spec: ChainSpec, rate: number): number {
  return Math.ceil(spec.effects.length * effectBytes(rate))
}

/** Two analysers on `output`, one per channel, and the splitter that taps it for them. */
function connectPeakAnalysers(
  ctx: BaseAudioContext,
  output: AudioNode,
): { tap: AudioNode; analysers: AnalyserNode[] } {
  const split = ctx.createChannelSplitter(2)
  output.connect(split)
  const analysers = [0, 1].map((channel) => {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = PEAK_SAMPLES
    analyser.smoothingTimeConstant = 0
    split.connect(analyser, channel)
    return analyser
  })
  return { tap: split, analysers }
}

/** What a graph is built of. */
interface StudioGraphParts {
  readonly output: GainNode
  readonly master: StudioFxChain | null
  readonly lanes: StudioGraphLane[]
  readonly peaks: { tap: AudioNode; analysers: AnalyserNode[] } | null
  readonly buses: StudioReverbBuses | null
}

function disposeParts(parts: StudioGraphParts): void {
  for (const lane of parts.lanes) disposeGraphLane(lane)
  parts.buses?.dispose()
  parts.master?.dispose()
  parts.peaks?.tap.disconnect()
  for (const analyser of parts.peaks?.analysers ?? []) analyser.disconnect()
  parts.output.disconnect()
}

/** Build the master, then each lane into it, then the meters. When a step fails, what it built goes too. */
function buildParts(
  ctx: BaseAudioContext,
  plan: StudioArrangementPlan,
  epoch: number,
  options: StudioGraphOptions,
): StudioGraphParts {
  const output = ctx.createGain()
  const lanes: StudioGraphLane[] = []
  let master: StudioFxChain | null = null
  let buses: StudioReverbBuses | null = null
  try {
    if (options.master) {
      master = createStudioFxChain(ctx, options.master.spec)
      master.output.connect(output)
    }
    const fromFrame = options.fromFrame ?? plan.startFrame
    const place = {
      output: master?.input ?? output,
      planStart: plan.startFrame,
      passStart: epoch - (fromFrame - plan.startFrame) / STUDIO_SAMPLE_RATE,
      fromFrame,
      profile: options.profile ?? FULL_FX_PROFILE,
      buses: undefined as StudioReverbBuses | undefined,
    }
    if (place.profile.reverbBus) {
      buses = createReverbBuses(ctx, place.output)
      place.buses = buses
    }
    for (const lane of studioGraphLanes(plan, options.silentLanes))
      lanes.push(buildGraphLane(ctx, lane, place))
    const peaks =
      options.metering === true ? connectPeakAnalysers(ctx, output) : null
    return { output, master, lanes, peaks, buses }
  } catch (error) {
    disposeParts({ output, master, lanes, peaks: null, buses })
    throw error
  }
}

export function buildStudioGraph(
  ctx: BaseAudioContext,
  plan: StudioArrangementPlan,
  buffers: ReadonlyMap<string, AudioBuffer>,
  epoch: number,
  options: StudioGraphOptions = {},
): StudioGraph {
  const loop = (plan.endFrame - plan.startFrame) / STUDIO_SAMPLE_RATE
  if (options.repeat === true && loop < MIN_LOOP_SECONDS)
    throw new Error('A song needs at least a quarter second to repeat.')
  const parts = buildParts(ctx, plan, epoch, options)
  const { output, master, lanes, peaks } = parts
  const byId = new Map(lanes.map((lane) => [lane.trackId, lane]))
  const outputs = new Map<string, AudioNode>(
    lanes.map((lane) => [lane.trackId, lane.merge]),
  )
  const state: StudioGraphState = {
    ctx,
    lanes,
    buffers,
    planStart: plan.startFrame,
    slowest: Math.max(
      0,
      ...plan.lanes.map((lane) => lane.chainLatencySeconds ?? 0),
    ),
    endFrame: plan.endFrame,
    looping: options.repeat === true,
    parked: false,
    disposed: false,
    epoch,
    fromFrame: options.fromFrame ?? plan.startFrame,
    pendingAt: -Infinity,
    profile: options.profile ?? FULL_FX_PROFILE,
    buses: parts.buses,
  }
  const peakSamples = new Float32Array(PEAK_SAMPLES)
  const playing = () => !state.disposed && !state.parked
  /** Whether the plan holds `fromFrame`: it starts no later and ends after it. */
  const reaches = (fromFrame: number) =>
    fromFrame >= state.planStart && fromFrame < state.endFrame

  return {
    output,
    scheduleUntil(time) {
      if (!playing()) return
      settleSwaps(state)
      settleIdleLanes(ctx, lanes)
      options.quality?.tick(ctx)
      const run = laneRun(state)
      for (const lane of lanes) scheduleLane(ctx, lane, time, run)
    },
    seekTime: (earliest) => seekTime(state, earliest),
    seek(fromFrame, at) {
      if (!playing() || !reaches(fromFrame) || swapping(state)) return null
      const time = seekTime(state, at)
      restartLanes(state, fromFrame, time, true)
      return time
    },
    replan: (next, earliest) => replanGraph(state, next, earliest),
    swapChains: (swaps, earliest) => swapChains(state, swaps, earliest),
    swapping: () => swapping(state),
    park() {
      if (!playing()) return
      state.parked = true
      for (const lane of lanes) silenceLane(lane)
      finishSwaps(state)
      if (peaks) output.disconnect(peaks.tap)
    },
    resume(fromFrame, at, repeat) {
      if (
        state.disposed ||
        !state.parked ||
        !reaches(fromFrame) ||
        (repeat && !canLoop(state))
      )
        return false
      state.looping = repeat
      state.parked = false
      if (peaks) output.connect(peaks.tap)
      restartLanes(state, fromFrame, at, false)
      return true
    },
    retime(epoch) {
      if (!playing()) return
      for (const lane of lanes) silenceLane(lane)
      restartLanes(state, state.fromFrame, epoch, false)
    },
    profile: () => state.profile,
    settle(at) {
      if (state.disposed) return
      master?.settle(at)
      for (const lane of lanes) lane.chain.settle(at)
    },
    hasLane: (trackId) => byId.has(trackId),
    setLaneMix(track, audible) {
      const lane = byId.get(track.id)
      if (!lane || state.disposed) return
      mixLane(ctx, lane, track, audible)
      if (audible) wakeLane(ctx, lane)
      else quietLane(ctx, lane)
    },
    setLaneSpec(trackId, spec) {
      const lane = byId.get(trackId)
      // A frozen lane's render already carries its sound; an edit that changes it builds a new run.
      if (state.disposed || !lane || lane.frozen) return
      lane.chain.setSpec(spec)
      lane.dynamics = dynamicsIds(lane.chain.getSpec())
      const trim = sendTrim(lane.chain.getSpec())
      retrimLaneSends(ctx, lane.sends, trim, laneCrossing(lane))
    },
    setMasterSpec(spec) {
      if (!state.disposed) master?.setSpec(spec)
    },
    laneOutputs: () => outputs,
    readLaneReduction(trackId) {
      const lane = byId.get(trackId)
      if (state.disposed || !lane || lane.dynamics.length === 0) return null
      let reduction = 0
      for (const id of lane.dynamics)
        reduction += Math.min(0, lane.chain.readReductionDb(id))
      return reduction
    },
    repeat: () => repeatLanes(state),
    stopRepeating: () => stopRepeatingLanes(state),
    readPeaks() {
      return [0, 1].map((channel) => {
        const analyser = peaks?.analysers[channel]
        if (!analyser) return 0
        analyser.getFloatTimeDomainData(peakSamples)
        let peak = 0
        for (const sample of peakSamples)
          peak = Math.max(peak, Math.abs(sample))
        return peak
      }) as [number, number]
    },
    dispose() {
      if (state.disposed) return
      state.disposed = true
      disposeParts(parts)
    },
  }
}
