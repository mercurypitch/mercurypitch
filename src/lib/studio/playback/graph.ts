// Studio graph — shared lane processing and source scheduling for live and offline consumers.
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { StudioArrangementPlan, StudioPlannedSegment, } from '../model/arrangement-plan'
import { studioPanGains } from '../model/arrangement-plan'
import { scheduleStudioSegmentGain } from './edge-envelope'

export interface StudioGraph {
  readonly output: GainNode
  scheduleUntil(time: number): void
  readPeaks(): readonly [number, number]
  dispose(): void
}

export function studioGraphWorkingBytes(
  plan: StudioArrangementPlan,
  rate: number,
): number {
  const count = plan.lanes
    .filter((lane) => lane.audible && lane.segments.length > 0)
    .reduce((sum, lane) => sum + lane.spec.effects.length, 0)
  // Includes the engine's bounded eight-impulse cache, generation copies,
  // delay lines and node overhead. Browser-private native allocations vary.
  return Math.ceil(
    8 * rate * 8 * 4 * 2 * 2 + count * (rate * 2 * 8 + 128 * 1024),
  )
}

export function buildStudioGraph(
  ctx: BaseAudioContext,
  plan: StudioArrangementPlan,
  buffers: ReadonlyMap<string, AudioBuffer>,
  epoch: number,
  metering = true,
): StudioGraph {
  const output = ctx.createGain()
  const disposers: (() => void)[] = []
  const sources = new Map<AudioBufferSourceNode, GainNode>()
  const scheduled: {
    segment: StudioPlannedSegment
    input: AudioNode
    when: number
  }[] = []
  let next = 0
  let disposed = false
  const analysers: AnalyserNode[] = []
  const peakSamples = new Float32Array(4096)
  try {
    for (const lane of plan.lanes) {
      if (!lane.audible || !lane.segments.length) continue
      if (lane.compensationSeconds === null)
        throw new Error('Studio chain timing has not been measured.')
      const chain = createStudioFxChain(ctx, lane.spec)
      disposers.push(() => chain.dispose())
      const split = ctx.createChannelSplitter(2)
      const merge = ctx.createChannelMerger(2)
      const [left, right] = studioPanGains(lane.track.pan)
      chain.output.connect(split)
      for (const [index, balance] of [left, right].entries()) {
        const gain = ctx.createGain()
        gain.gain.value =
          balance *
          Math.pow(10, (lane.track.gainDb + lane.track.balanceGainDb) / 20)
        split.connect(gain, index)
        gain.connect(merge, 0, index)
        disposers.push(() => gain.disconnect())
      }
      merge.connect(output)
      disposers.push(
        () => split.disconnect(),
        () => merge.disconnect(),
      )
      for (const segment of lane.segments)
        scheduled.push({
          segment,
          input: chain.input,
          when:
            epoch +
            (segment.startFrame - plan.startFrame) / 48000 +
            lane.compensationSeconds,
        })
    }
    scheduled.sort((a, b) => a.when - b.when)
    if (metering) {
      const split = ctx.createChannelSplitter(2)
      output.connect(split)
      disposers.push(() => split.disconnect())
      for (let channel = 0; channel < 2; channel++) {
        const analyser = ctx.createAnalyser()
        analyser.fftSize = peakSamples.length
        analyser.smoothingTimeConstant = 0
        split.connect(analyser, channel)
        analysers.push(analyser)
        disposers.push(() => analyser.disconnect())
      }
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
      while (next < scheduled.length && scheduled[next].when <= time) {
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
