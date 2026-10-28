// Studio graph — shared lane processing and source scheduling for live and offline consumers.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioArrangementPlan, StudioPlannedLane, StudioPlannedSegment, } from '../model/arrangement-plan'
import { studioPanGains } from '../model/arrangement-plan'
import type { StudioTrack } from '../model/types'
import { scheduleStudioSegmentGain } from './edge-envelope'
import type { StudioLaneInput, StudioSourceSet } from './seek-crossfade'
import { closeStudioSourceSet, emptyStudioSourceSet, openStudioSourceSet, retireStudioSourceSet, stopStudioSource, } from './seek-crossfade'

export interface StudioGraph {
  readonly output: GainNode
  scheduleUntil(time: number): void
  /**
   * When a seek asked for no sooner than `earliest` would start: then, or
   * at the newest seek's own time while that one is not heard yet, since a
   * newer seek takes its place there.
   */
  seekTime(earliest: number): number
  /**
   * Play from `fromFrame` instead, crossfading each lane from its sources to
   * the new ones (seek-crossfade.ts); the chains, master and meters play on.
   * The frame enters a lane with no compensation at the returned time:
   * seekTime(at), so pass a time from seekTime to keep two graphs in step.
   * Null when the plan starts after `fromFrame` or ends before it. Call
   * scheduleUntil after it, as the new sources start at once.
   */
  seek(fromFrame: number, at: number): number | null
  readPeaks(): readonly [number, number]
  /**
   * Whether this track has a lane here. Playback builds every lane with
   * clips, silent ones at zero gain; a render builds only what it hears.
   */
  hasLane(trackId: string): boolean
  /** Glide a built lane's volume and pan, or silence it, while it plays. */
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
}

/**
 * A pass this close to its start counts as begun: the audio thread renders
 * ahead of the clock the page reads, so its first sources may already play.
 */
const BEGUN_MARGIN_SECONDS = 0.05

interface Scheduled {
  readonly segment: StudioPlannedSegment
  /** Its lane, as an index into the graph's lane inputs. */
  readonly lane: number
  readonly when: number
}

/** A segment's place in one pass: seconds after the plan's start, its lane's compensation included. */
interface Planned {
  readonly segment: StudioPlannedSegment
  readonly lane: number
  readonly base: number
}

/** Where the graph reads: frame `fromFrame` enters a lane with no compensation at `epoch`. */
interface Timeline {
  readonly epoch: number
  /** Seconds from the plan's start to `fromFrame`. */
  readonly offset: number
  /** One pass of the whole plan, timed so the second pass starts where the first, which may begin part-way through, ends. */
  readonly cycle: readonly Scheduled[]
  scheduled: Scheduled[]
  next: number
  /** The pass being scheduled, which runs up to two seconds ahead of the one heard. */
  pass: number
}

function timelineFrom(
  planned: readonly Planned[],
  plan: StudioArrangementPlan,
  fromFrame: number,
  epoch: number,
): Timeline {
  const offset = (fromFrame - plan.startFrame) / 48000
  const cycle = planned
    .map(({ segment, lane, base }) => ({
      segment,
      lane,
      when: epoch - offset + base,
    }))
    .sort((a, b) => a.when - b.when)
  return {
    epoch,
    offset,
    cycle,
    scheduled: firstPass(cycle, fromFrame),
    next: 0,
    pass: 0,
  }
}

/** The broadband dynamics in a chain, whose reductions add up to the lane's. */
function dynamicsIds(spec: ChainSpec): string[] {
  return spec.effects
    .filter(
      (effect) =>
        effect.enabled &&
        (effect.kind === 'compressor' || effect.kind === 'limiter'),
    )
    .map((effect) => effect.id)
}

/** Left and right lane gains: pan law times volume and balance. */
function laneGains(track: StudioTrack): readonly [number, number] {
  const [left, right] = studioPanGains(track.pan)
  const gain = Math.pow(10, (track.gainDb + track.balanceGainDb) / 20)
  return [left * gain, right * gain]
}

/** The lanes a graph builds: those with clips, and only the audible ones unless silent lanes are wanted. */
export function studioGraphLanes(
  plan: StudioArrangementPlan,
  silentLanes = false,
): StudioPlannedLane[] {
  return plan.lanes.filter(
    (lane) => lane.segments.length > 0 && (silentLanes || lane.audible),
  )
}

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
  return Math.ceil(
    8 * rate * 8 * 4 * 2 * 2 + count * (rate * 2 * 8 + 128 * 1024),
  )
}

/** What the graph keeps of each lane: its chain, its fader gains and their output. */
interface BuiltLanes {
  readonly mixes: Map<string, GainNode[]>
  readonly chains: Map<string, StudioFxChain>
  readonly outputs: Map<string, AudioNode>
  readonly dynamics: Map<string, string[]>
}

function connectLane(
  ctx: BaseAudioContext,
  lane: StudioPlannedLane,
  output: AudioNode,
  disposers: (() => void)[],
  built: BuiltLanes,
): AudioNode {
  const chain = createStudioFxChain(ctx, lane.spec)
  built.chains.set(lane.track.id, chain)
  built.dynamics.set(lane.track.id, dynamicsIds(chain.getSpec()))
  disposers.push(() => chain.dispose())
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  const gains: GainNode[] = []
  built.mixes.set(lane.track.id, gains)
  built.outputs.set(lane.track.id, merge)
  chain.output.connect(split)
  const values = lane.audible ? laneGains(lane.track) : [0, 0]
  for (const [index, value] of values.entries()) {
    const gain = ctx.createGain()
    gain.gain.value = value
    gains.push(gain)
    split.connect(gain, index)
    gain.connect(merge, 0, index)
    disposers.push(() => gain.disconnect())
  }
  merge.connect(output)
  disposers.push(
    () => split.disconnect(),
    () => merge.disconnect(),
  )
  return chain.input
}

function connectPeakAnalysers(
  ctx: BaseAudioContext,
  output: AudioNode,
  fftSize: number,
  disposers: (() => void)[],
): AnalyserNode[] {
  const split = ctx.createChannelSplitter(2)
  output.connect(split)
  disposers.push(() => split.disconnect())
  const analysers: AnalyserNode[] = []
  for (let channel = 0; channel < 2; channel++) {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0
    split.connect(analyser, channel)
    analysers.push(analyser)
    disposers.push(() => analyser.disconnect())
  }
  return analysers
}

/** The first pass from `fromFrame`: what ends before it is skipped, what spans it starts part-way. */
function firstPass(
  cycle: readonly Scheduled[],
  fromFrame: number,
): Scheduled[] {
  return cycle
    .flatMap((item) => {
      const end =
        item.segment.startFrame +
        item.segment.sourceOutFrame -
        item.segment.sourceInFrame
      if (end <= fromFrame) return []
      const skipped = Math.max(0, fromFrame - item.segment.startFrame)
      return [
        {
          ...item,
          when: item.when + skipped / 48000,
          segment: {
            ...item.segment,
            startFrame: item.segment.startFrame + skipped,
            sourceInFrame: item.segment.sourceInFrame + skipped,
          },
        },
      ]
    })
    .sort((a, b) => a.when - b.when)
}

export function buildStudioGraph(
  ctx: BaseAudioContext,
  plan: StudioArrangementPlan,
  buffers: ReadonlyMap<string, AudioBuffer>,
  epoch: number,
  options: StudioGraphOptions = {},
): StudioGraph {
  const output = ctx.createGain()
  const disposers: (() => void)[] = []
  const built: BuiltLanes = {
    mixes: new Map(),
    chains: new Map(),
    outputs: new Map(),
    dynamics: new Map(),
  }
  const { mixes, chains } = built
  let masterChain: StudioFxChain | null = null
  const lanes: StudioLaneInput[] = []
  const planned: Planned[] = []
  const cycleSeconds = (plan.endFrame - plan.startFrame) / 48000
  if (options.repeat === true && cycleSeconds < 0.25)
    throw new Error('A song needs at least a quarter second to repeat.')
  let looping = options.repeat === true
  let disposed = false
  const analysers: AnalyserNode[] = []
  const peakSamples = new Float32Array(4096)
  try {
    let laneOutput: AudioNode = output
    if (options.master) {
      const chain = createStudioFxChain(ctx, options.master.spec)
      chain.output.connect(output)
      laneOutput = chain.input
      masterChain = chain
      disposers.push(() => chain.dispose())
    }
    for (const lane of studioGraphLanes(plan, options.silentLanes)) {
      if (lane.compensationSeconds === null)
        throw new Error('Studio chain timing has not been measured.')
      const input = connectLane(ctx, lane, laneOutput, disposers, built)
      const index = lanes.push({
        input,
        compensation: lane.compensationSeconds,
      })
      for (const segment of lane.segments)
        planned.push({
          segment,
          lane: index - 1,
          base:
            (segment.startFrame - plan.startFrame) / 48000 +
            lane.compensationSeconds,
        })
    }
    if (options.metering === true) {
      analysers.push(
        ...connectPeakAnalysers(ctx, output, peakSamples.length, disposers),
      )
    }
  } catch (error) {
    for (const dispose of disposers) dispose()
    output.disconnect()
    throw error
  }
  let timeline = timelineFrom(
    planned,
    plan,
    options.fromFrame ?? plan.startFrame,
    epoch,
  )
  // The sources of each Play and each seek still sounding; the newest is current.
  let current = openStudioSourceSet(ctx, lanes, null)
  const sets = new Set([current])
  /** Whether pass `index` has begun, or is about to, on the context clock. */
  const begun = (index: number) =>
    (index === 0
      ? timeline.epoch
      : timeline.epoch - timeline.offset + index * cycleSeconds) <=
    ctx.currentTime + BEGUN_MARGIN_SECONDS

  function close(set: StudioSourceSet): void {
    closeStudioSourceSet(set)
    sets.delete(set)
  }

  function start({ segment, lane, when }: Scheduled): void {
    if (when < ctx.currentTime - 0.02)
      throw new Error(
        'Studio playback could not keep up. Press Play to try again.',
      )
    const buffer = buffers.get(segment.assetId)
    if (!buffer) throw new Error('Studio audio is missing.')
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.channelCount = 2
    gain.channelCountMode = 'explicit'
    gain.channelInterpretation = 'speakers'
    gain.gain.value = 0
    source.connect(gain)
    const set = current
    gain.connect(set.fades[lane].fadeOut)
    set.sources.set(source, { gain, pass: timeline.pass, lane, when })
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      set.sources.delete(source)
      if (set.retired && !set.sources.size) close(set)
    }
    scheduleStudioSegmentGain(gain.gain, segment, when)
    source.start(
      when,
      segment.sourceInFrame / 48000,
      (segment.sourceOutFrame - segment.sourceInFrame) / 48000,
    )
  }

  /** Whether the newest seek is still ahead of the clock, so a newer one can take its place. */
  const unheard = () => current.at > ctx.currentTime
  const seekTime = (earliest: number) =>
    unheard() ? Math.max(earliest, current.at) : earliest

  return {
    output,
    scheduleUntil(time) {
      if (disposed) return
      while (true) {
        if (timeline.next >= timeline.scheduled.length) {
          if (!looping || !timeline.cycle.length) break
          timeline.pass++
          const shift = timeline.pass * cycleSeconds
          timeline.scheduled = timeline.cycle.map((item) => ({
            ...item,
            when: item.when + shift,
          }))
          timeline.next = 0
        }
        if (timeline.scheduled[timeline.next].when > time) break
        start(timeline.scheduled[timeline.next])
        timeline.next++
      }
    },
    seekTime,
    seek(fromFrame, at) {
      if (disposed || fromFrame < plan.startFrame || fromFrame >= plan.endFrame)
        return null
      const time = seekTime(at)
      if (time === current.at && unheard()) {
        // The last seek is not heard yet: this one takes its place.
        emptyStudioSourceSet(current)
      } else {
        const last = current
        if (!retireStudioSourceSet(last, lanes, time)) close(last)
        current = openStudioSourceSet(ctx, lanes, time)
        sets.add(current)
      }
      timeline = timelineFrom(planned, plan, fromFrame, time)
      return time
    },
    hasLane: (trackId) => mixes.has(trackId),
    setLaneMix(track, audible) {
      const gains = mixes.get(track.id)
      if (!gains || disposed) return
      const values = audible ? laneGains(track) : [0, 0]
      const now = ctx.currentTime
      // A 12 ms glide, so a fader release or a mute does not click.
      for (const [index, gain] of gains.entries()) {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setTargetAtTime(values[index], now, 0.012)
      }
    },
    setLaneSpec(trackId, spec) {
      const chain = chains.get(trackId)
      if (disposed || !chain) return
      chain.setSpec(spec)
      built.dynamics.set(trackId, dynamicsIds(chain.getSpec()))
    },
    setMasterSpec(spec) {
      if (!disposed) masterChain?.setSpec(spec)
    },
    laneOutputs: () => built.outputs,
    readLaneReduction(trackId) {
      const chain = chains.get(trackId)
      const ids = built.dynamics.get(trackId)
      if (disposed || !chain || ids === undefined || ids.length === 0)
        return null
      let reduction = 0
      for (const id of ids) reduction += Math.min(0, chain.readReductionDb(id))
      return reduction
    },
    repeat() {
      if (disposed || cycleSeconds < 0.25 || !timeline.cycle.length)
        return false
      if (!looping && begun(timeline.pass + 1)) return false
      looping = true
      return true
    },
    stopRepeating() {
      looping = false
      let last = timeline.pass
      while (last > 0 && !begun(last)) last--
      if (last === timeline.pass) return last
      // Passes queued ahead have not begun: none of them plays. The one
      // that has began was scheduled in full before the next was queued.
      for (const [source, entry] of current.sources) {
        if (entry.pass <= last) continue
        stopStudioSource(source, entry.gain)
        current.sources.delete(source)
      }
      timeline.pass = last
      timeline.scheduled = []
      timeline.next = 0
      return last
    },
    readPeaks() {
      return [0, 1].map((channel) => {
        const analyser = analysers[channel]
        if (channel >= analysers.length) return 0
        analyser.getFloatTimeDomainData(peakSamples)
        let peak = 0
        for (const sample of peakSamples)
          peak = Math.max(peak, Math.abs(sample))
        return peak
      }) as [number, number]
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const set of sets) {
        emptyStudioSourceSet(set)
        closeStudioSourceSet(set)
      }
      sets.clear()
      for (const dispose of disposers) dispose()
      output.disconnect()
    },
  }
}
