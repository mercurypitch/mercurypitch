// Studio graph — shared lane processing and source scheduling for live and offline consumers.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioArrangementPlan, StudioPlannedLane, StudioPlannedSegment, } from '../model/arrangement-plan'
import { studioPanGains } from '../model/arrangement-plan'
import type { StudioTrack } from '../model/types'
import { scheduleStudioSegmentGain } from './edge-envelope'

export interface StudioGraph {
  readonly output: GainNode
  scheduleUntil(time: number): void
  readPeaks(): readonly [number, number]
  /** Whether this track has a lane here: silent lanes are never built. */
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
  dispose(): void
}

/** Left and right lane gains: pan law times volume and balance. */
function laneGains(track: StudioTrack): readonly [number, number] {
  const [left, right] = studioPanGains(track.pan)
  const gain = Math.pow(10, (track.gainDb + track.balanceGainDb) / 20)
  return [left * gain, right * gain]
}

export function studioGraphWorkingBytes(
  plan: StudioArrangementPlan,
  rate: number,
  masterSpec?: ChainSpec,
): number {
  const count = plan.lanes
    .filter((lane) => lane.audible && lane.segments.length > 0)
    .reduce(
      (sum, lane) => sum + lane.spec.effects.length,
      masterSpec?.effects.length ?? 0,
    )
  // Includes the engine's bounded eight-impulse cache, generation copies,
  // delay lines and node overhead. Browser-private native allocations vary.
  return Math.ceil(
    8 * rate * 8 * 4 * 2 * 2 + count * (rate * 2 * 8 + 128 * 1024),
  )
}

function connectLane(
  ctx: BaseAudioContext,
  lane: StudioPlannedLane,
  output: AudioNode,
  disposers: (() => void)[],
  mixes: Map<string, GainNode[]>,
  chains: Map<string, StudioFxChain>,
): AudioNode {
  const chain = createStudioFxChain(ctx, lane.spec)
  chains.set(lane.track.id, chain)
  disposers.push(() => chain.dispose())
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  const gains: GainNode[] = []
  mixes.set(lane.track.id, gains)
  chain.output.connect(split)
  for (const [index, value] of laneGains(lane.track).entries()) {
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

export function buildStudioGraph(
  ctx: BaseAudioContext,
  plan: StudioArrangementPlan,
  buffers: ReadonlyMap<string, AudioBuffer>,
  epoch: number,
  metering = true,
  repeatFromFrame?: number,
  master?: { spec: ChainSpec },
): StudioGraph {
  const output = ctx.createGain()
  const disposers: (() => void)[] = []
  const sources = new Map<AudioBufferSourceNode, GainNode>()
  const mixes = new Map<string, GainNode[]>()
  const chains = new Map<string, StudioFxChain>()
  let masterChain: StudioFxChain | null = null
  const scheduled: {
    segment: StudioPlannedSegment
    input: AudioNode
    when: number
  }[] = []
  let next = 0
  let cycle = 0
  let repeating: typeof scheduled = []
  const repeatSeconds = (plan.endFrame - plan.startFrame) / 48000
  if (repeatFromFrame !== undefined && repeatSeconds < 0.25)
    throw new Error('A song needs at least a quarter second to repeat.')
  let disposed = false
  const analysers: AnalyserNode[] = []
  const peakSamples = new Float32Array(4096)
  try {
    let laneOutput: AudioNode = output
    if (master) {
      const chain = createStudioFxChain(ctx, master.spec)
      chain.output.connect(output)
      laneOutput = chain.input
      masterChain = chain
      disposers.push(() => chain.dispose())
    }
    for (const lane of plan.lanes) {
      if (!lane.audible || !lane.segments.length) continue
      if (lane.compensationSeconds === null)
        throw new Error('Studio chain timing has not been measured.')
      const input = connectLane(ctx, lane, laneOutput, disposers, mixes, chains)
      for (const segment of lane.segments)
        scheduled.push({
          segment,
          input,
          when:
            epoch +
            (segment.startFrame - plan.startFrame) / 48000 +
            lane.compensationSeconds,
        })
    }
    scheduled.sort((a, b) => a.when - b.when)
    if (repeatFromFrame !== undefined) {
      const offset = (repeatFromFrame - plan.startFrame) / 48000
      repeating = scheduled.map((item) => ({
        ...item,
        when: item.when - offset,
      }))
      const first = repeating.flatMap((item) => {
        const end =
          item.segment.startFrame +
          item.segment.sourceOutFrame -
          item.segment.sourceInFrame
        if (end <= repeatFromFrame) return []
        const skipped = Math.max(0, repeatFromFrame - item.segment.startFrame)
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
      first.sort((a, b) => a.when - b.when)
      scheduled.splice(0, scheduled.length, ...first)
    }
    if (metering) {
      analysers.push(
        ...connectPeakAnalysers(ctx, output, peakSamples.length, disposers),
      )
    }
  } catch (error) {
    for (const dispose of disposers) dispose()
    output.disconnect()
    throw error
  }
  return {
    output,
    scheduleUntil(time) {
      if (disposed) return
      while (true) {
        if (next >= scheduled.length) {
          if (!repeating.length) break
          cycle++
          scheduled.splice(
            0,
            scheduled.length,
            ...repeating.map((item) => ({
              ...item,
              when: item.when + cycle * repeatSeconds,
            })),
          )
          next = 0
        }
        if (scheduled[next].when > time) break
        const { segment, input, when } = scheduled[next++]
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
        gain.connect(input)
        sources.set(source, gain)
        source.onended = () => {
          source.disconnect()
          gain.disconnect()
          sources.delete(source)
        }
        scheduleStudioSegmentGain(gain.gain, segment, when)
        source.start(
          when,
          segment.sourceInFrame / 48000,
          (segment.sourceOutFrame - segment.sourceInFrame) / 48000,
        )
      }
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
      if (!disposed) chains.get(trackId)?.setSpec(spec)
    },
    setMasterSpec(spec) {
      if (!disposed) masterChain?.setSpec(spec)
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
      for (const [source, gain] of sources) {
        source.onended = null
        try {
          source.stop()
        } catch {
          /* An ended source needs only disconnecting. */
        }
        source.disconnect()
        gain.disconnect()
      }
      sources.clear()
      for (const dispose of disposers) dispose()
      output.disconnect()
    },
  }
}
