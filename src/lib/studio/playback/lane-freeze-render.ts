// ============================================================
// Studio lane freeze render — one lane through its chain at Best, offline, as the live graph plays it
// ============================================================
//
// The render feeds the chain exactly what a live lane feeds it: each
// segment's source through a stereo gain carrying its edge envelope
// (edge-envelope.ts), into the chain built at full quality. Compressors are
// settled on half a second of silence first, as a run settles them before
// its first frame (run.ts), and the chain's latency is cut from the front,
// so the render lines up with the timeline. What rings on after a clip is
// rendered too, for as long as the chain's tail estimate says.
//
// A lane renders run by run: clips whose tails overlap make one run, and a
// run starts on a chain as idle as the live one is after that much silence.
// The silence between runs is never rendered, and a render's working memory
// is its longest run, not the song: an eight-minute lane with six clips
// needs a sixth of it.
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { FULL_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { estimateTailSeconds } from '@/lib/studio-fx/render'
import type { StudioPlannedLane, StudioPlannedSegment, } from '../model/arrangement-plan'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { scheduleStudioSegmentGain } from './edge-envelope'
import type { StudioFrozenChunk, StudioFrozenLane } from './lane-freeze'
import { encodeFrozenLane } from './lane-freeze'
import { segmentEnd } from './lane-timeline'

/** Silence before the first clip, for the compressors to settle on: an export's lead. */
export const FREEZE_PRE_ROLL_FRAMES = 24000
/** Past the tail estimate, so a decay is cut well under the silence floor. */
const TAIL_MARGIN_FRAMES = 12000

/** Clips whose tails overlap, rendered on one chain from `startFrame` for `length` frames. */
export interface StudioLaneRenderRun {
  readonly startFrame: number
  readonly length: number
  readonly segments: readonly StudioPlannedSegment[]
}

/** A lane's runs in timeline order: each from its first clip to past its last tail. */
export function laneRenderRuns(
  lane: Pick<StudioPlannedLane, 'segments' | 'spec'>,
): StudioLaneRenderRun[] {
  const tail = freezeTailFrames(lane.spec)
  const sorted = [...lane.segments].sort((a, b) => a.startFrame - b.startFrame)
  const runs: {
    startFrame: number
    end: number
    segments: StudioPlannedSegment[]
  }[] = []
  for (const segment of sorted) {
    const end = segmentEnd(segment) + tail
    const open = runs.at(-1)
    if (open && segment.startFrame <= open.end) {
      open.end = Math.max(open.end, end)
      open.segments.push(segment)
    } else
      runs.push({ startFrame: segment.startFrame, end, segments: [segment] })
  }
  return runs.map(({ startFrame, end, segments }) => ({
    startFrame,
    length: end - startFrame,
    segments,
  }))
}

export function freezeTailFrames(spec: ChainSpec): number {
  return (
    Math.ceil(estimateTailSeconds(spec) * STUDIO_SAMPLE_RATE) +
    TAIL_MARGIN_FRAMES
  )
}

/** What rendering `lane` holds at its peak: its longest run's output and the chain's own buffers. */
export function laneRenderWorkingBytes(
  lane: Pick<StudioPlannedLane, 'segments' | 'spec'>,
  latencyFrames: number,
): number {
  const longest = Math.max(0, ...laneRenderRuns(lane).map((run) => run.length))
  return (
    (FREEZE_PRE_ROLL_FRAMES + latencyFrames + longest) * 2 * 4 +
    lane.spec.effects.length * (STUDIO_SAMPLE_RATE * 16 + 128 * 1024)
  )
}

export interface StudioLaneRenderOptions {
  /** The chain's latency in frames at 48 kHz, measured as playback measures it. */
  readonly latencyFrames: number
  readonly key: string
  readonly signal: AbortSignal
  readonly createContext?: (frames: number) => OfflineAudioContext
}

/** Render `lane`, as compiled from the song's start, from `buffers`. */
export async function renderLaneFreeze(
  lane: StudioPlannedLane,
  buffers: ReadonlyMap<string, AudioBuffer>,
  options: StudioLaneRenderOptions,
): Promise<StudioFrozenLane> {
  const info = {
    trackId: lane.track.id,
    key: options.key,
    spec: JSON.stringify(lane.spec),
  }
  const chunks: StudioFrozenChunk[] = []
  let bytes = 0
  for (const run of laneRenderRuns(lane)) {
    const rendered = await renderRun(lane.spec, run, buffers, options)
    const frozen = encodeFrozenLane(info, rendered, run.startFrame)
    chunks.push(...frozen.chunks)
    bytes += frozen.bytes
  }
  return { ...info, chunks, bytes }
}

/** One run through a chain of its own, its latency and settling cut off. */
async function renderRun(
  spec: ChainSpec,
  run: StudioLaneRenderRun,
  buffers: ReadonlyMap<string, AudioBuffer>,
  options: StudioLaneRenderOptions,
): Promise<[Float32Array, Float32Array]> {
  options.signal.throwIfAborted()
  const skip = FREEZE_PRE_ROLL_FRAMES + options.latencyFrames
  const ctx =
    options.createContext?.(skip + run.length) ??
    new OfflineAudioContext(2, skip + run.length, STUDIO_SAMPLE_RATE)
  const chain = createStudioFxChain(ctx, spec, { profile: FULL_FX_PROFILE })
  try {
    chain.output.connect(ctx.destination)
    chain.settle(0)
    for (const segment of run.segments) {
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
      gain.connect(chain.input)
      const when =
        (FREEZE_PRE_ROLL_FRAMES + segment.startFrame - run.startFrame) /
        STUDIO_SAMPLE_RATE
      scheduleStudioSegmentGain(gain.gain, segment, when)
      source.start(
        when,
        segment.sourceInFrame / STUDIO_SAMPLE_RATE,
        (segment.sourceOutFrame - segment.sourceInFrame) / STUDIO_SAMPLE_RATE,
      )
    }
    const rendered = await ctx.startRendering()
    options.signal.throwIfAborted()
    const left = rendered.getChannelData(0)
    const right =
      rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left
    return [
      left.subarray(skip, skip + run.length),
      right.subarray(skip, skip + run.length),
    ]
  } finally {
    chain.dispose()
  }
}
