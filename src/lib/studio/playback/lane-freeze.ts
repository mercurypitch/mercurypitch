// ============================================================
// Studio lane freeze — a lane's chain rendered ahead, played as audio instead of run live
// ============================================================
//
// Web Audio renders every chain of a song on one realtime thread. A song with
// many lanes outgrows it on a slower device, and Auto's lighter tiers only go
// so far (playback-quality.ts). A lane nobody is editing sounds the same
// whether its chain runs live or its output plays back, so the freezer
// (lane-freezer.ts) renders such lanes offline, at Best, and a run plays
// them from that render through an empty chain: a lane then costs what its
// sources and faders cost. The render is the lane before its faders, so
// volume, pan, Mute and Solo still move it while it plays.
//
// A frozen lane is stored as 16-bit chunks, each scaled to its own peak, and
// a run turns a chunk into an AudioBuffer only when its scheduler starts it,
// about two seconds ahead (lane-timeline.ts). The render is aligned to the
// timeline with the chain's latency taken out, so the lane plays with no
// compensation of its own and lines up with the live lanes like any other.
//
// Two chunks never meet edge to edge. A chunk started between two frames
// plays interpolated and blends its last sample with silence, so butted
// chunks would click once every four seconds wherever a run plays between
// frames: always on a 44.1 kHz context, which resamples them. Runs start on
// whole frames (whole-frame.ts), and still each chunk holds a few frames of
// its neighbours and adjacent chunks cross over 128 frames with
// complementary linear fades, timed from the same frames: the two gains sum
// to one on every frame wherever a start lands, and the audio is the
// render's.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import type { StudioArrangementPlan, StudioPlannedLane, StudioPlannedSegment, } from '../model/arrangement-plan'
import { compileStudioArrangement, studioLaneSpec, } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { STUDIO_EDGE_FRAMES, STUDIO_EDGE_POLICY_VERSION } from './edge-envelope'

/** Bumped when a render made before would no longer match the live chain. */
export const LANE_FREEZE_VERSION = 1
/** Four seconds a chunk: about two of them per frozen lane are decoded at a time. */
export const FREEZE_CHUNK_FRAMES = 4 * 48000
/** The crossover between adjacent chunks, centred on their join. */
export const FREEZE_JOIN_FRAMES = 128
/** Frames a chunk holds past each edge: half a crossover and two to spare. */
export const FREEZE_OVERLAP_FRAMES = FREEZE_JOIN_FRAMES / 2 + 2
/** A chunk whose peak stays under -100 dBFS is silence and is not kept. */
export const FREEZE_SILENCE = 1e-5
const INT16_MAX = 32767

/** Four seconds of a frozen lane, both channels, each scaled to its own peak. */
export interface StudioFrozenChunk {
  /** Where its buffer is found in a run's audio: unique within the run. */
  readonly id: string
  /** The timeline frame its own span starts at; its data starts FREEZE_OVERLAP_FRAMES sooner. */
  readonly startFrame: number
  /** Frames in its own span; its data holds FREEZE_OVERLAP_FRAMES more at each end. */
  readonly frames: number
  readonly scales: readonly [number, number]
  readonly data: readonly [Int16Array, Int16Array]
}

/** A lane's chain output, rendered for the plan its key names. */
export interface StudioFrozenLane {
  readonly trackId: string
  readonly key: string
  /** Its chain alone, as JSON: a sound edit on unchanged clips is checked against it. */
  readonly spec: string
  readonly chunks: readonly StudioFrozenChunk[]
  readonly bytes: number
}

/**
 * Everything a lane's output depends on before its faders: its chain as it
 * plays (macros included) and what its clips play, where and how loud. A
 * render matches a lane only while this key does.
 */
export function laneFreezeKey(lane: StudioPlannedLane): string {
  return JSON.stringify([
    LANE_FREEZE_VERSION,
    STUDIO_EDGE_POLICY_VERSION,
    lane.spec,
    lane.segments.map(({ clipIds: _clipIds, ...sound }) => sound),
  ])
}

/** The bytes a chunk of `frames` holds. */
export function frozenChunkBytes(frames: number): number {
  return (frames + 2 * FREEZE_OVERLAP_FRAMES) * 2 * 2
}

function peakOf(samples: Float32Array, from: number, to: number): number {
  let peak = 0
  for (let i = from; i < to; i++) {
    const value = Math.abs(samples[i])
    if (value > peak) peak = value
  }
  return peak
}

function encodeChannel(
  samples: Float32Array,
  from: number,
  length: number,
  scale: number,
): Int16Array {
  const data = new Int16Array(length)
  if (scale === 0) return data
  for (let i = 0; i < length; i++) {
    const at = from + i
    const value = at >= 0 && at < samples.length ? samples[at] / scale : 0
    data[i] = Math.max(-INT16_MAX, Math.min(INT16_MAX, Math.round(value)))
  }
  return data
}

/**
 * Cut a lane's rendered output, `startFrame` on the timeline at its first
 * sample, into chunks; silent ones are left out. Each chunk's scale covers
 * the overlap it carries, so that never clips.
 */
export function encodeFrozenLane(
  lane: Pick<StudioFrozenLane, 'trackId' | 'key' | 'spec'>,
  channels: readonly [Float32Array, Float32Array],
  startFrame: number,
): StudioFrozenLane {
  const { trackId } = lane
  const [left, right] = channels
  const length = Math.min(left.length, right.length)
  const chunks: StudioFrozenChunk[] = []
  const overlap = FREEZE_OVERLAP_FRAMES
  for (let at = 0; at < length; at += FREEZE_CHUNK_FRAMES) {
    const frames = Math.min(FREEZE_CHUNK_FRAMES, length - at)
    const own = Math.max(
      peakOf(left, at, at + frames),
      peakOf(right, at, at + frames),
    )
    if (own < FREEZE_SILENCE) continue
    const from = Math.max(0, at - overlap)
    const to = Math.min(length, at + frames + overlap)
    const scales = [
      peakOf(left, from, to) / INT16_MAX,
      peakOf(right, from, to) / INT16_MAX,
    ] as const
    const span = frames + 2 * overlap
    chunks.push({
      id: `freeze:${trackId}:${startFrame + at}`,
      startFrame: startFrame + at,
      frames,
      scales,
      data: [
        encodeChannel(left, at - overlap, span, scales[0]),
        encodeChannel(right, at - overlap, span, scales[1]),
      ],
    })
  }
  const bytes = chunks.reduce(
    (total, chunk) => total + frozenChunkBytes(chunk.frames),
    0,
  )
  return { ...lane, chunks, bytes }
}

/** A chunk as audio the clock can play. */
export function decodeFrozenChunk(
  ctx: BaseAudioContext,
  chunk: StudioFrozenChunk,
): AudioBuffer {
  const length = chunk.frames + 2 * FREEZE_OVERLAP_FRAMES
  const buffer = ctx.createBuffer(2, length, 48000)
  for (let channel = 0; channel < 2; channel++) {
    const data = chunk.data[channel]
    const scale = chunk.scales[channel]
    const out = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) out[i] = data[i] * scale
  }
  return buffer
}

/**
 * The segments a frozen lane plays from `planStart`: one per chunk, at unity,
 * the render already carrying the clips' gains, fades and edges. A chunk
 * that meets a neighbour plays half a crossover into it, a frame more, and
 * fades across the join as the neighbour fades in. The group spans every
 * chunk with an edge to spare, so the safety ramp (edge-envelope.ts) stays
 * at one throughout.
 */
export function frozenSegments(
  lane: StudioFrozenLane,
  planStart: number,
): StudioPlannedSegment[] {
  const { chunks } = lane
  if (!chunks.length) return []
  const half = FREEZE_JOIN_FRAMES / 2
  const overlap = FREEZE_OVERLAP_FRAMES
  const last = chunks[chunks.length - 1]
  const groupStartFrame = chunks[0].startFrame - overlap - STUDIO_EDGE_FRAMES
  const groupEndFrame =
    last.startFrame + last.frames + overlap + STUDIO_EDGE_FRAMES
  return chunks.flatMap((chunk, index) => {
    const before = chunks[index - 1]
    const after = chunks[index + 1]
    const joinsBefore =
      before !== undefined &&
      before.startFrame + before.frames === chunk.startFrame
    const joinsAfter =
      after !== undefined &&
      chunk.startFrame + chunk.frames === after.startFrame
    // The timeline frame of the chunk's first stored sample.
    const origin = chunk.startFrame - overlap
    const ownEnd = chunk.startFrame + chunk.frames
    const start = joinsBefore ? chunk.startFrame - half - 1 : chunk.startFrame
    const end = joinsAfter ? ownEnd + half + 1 : ownEnd
    if (end <= planStart) return []
    const from = Math.max(planStart, start)
    const fades: Mutable<StudioPlannedSegment['fades']> = {
      curve: 'linear-amplitude',
    }
    if (joinsBefore)
      fades.in = {
        fromSourceFrame: chunk.startFrame - half - origin,
        toSourceFrame: chunk.startFrame + half - origin,
      }
    if (joinsAfter)
      fades.out = {
        fromSourceFrame: ownEnd - half - origin,
        toSourceFrame: ownEnd + half - origin,
      }
    return [
      {
        clipIds: [],
        assetId: chunk.id,
        startFrame: from,
        groupStartFrame,
        groupEndFrame,
        sourceInFrame: from - origin,
        sourceOutFrame: end - origin,
        gainDb: 0,
        preparationGainDb: 0,
        fades,
      },
    ]
  })
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** The chain a frozen lane runs through: none, so no latency either. */
export const FROZEN_LANE_SPEC: ChainSpec = EMPTY_CHAIN

/**
 * The plan with each frozen lane playing its render through an empty chain.
 * The plan's latencies must already count a frozen lane as zero, so the live
 * lanes' compensation lines them up (prepare-plan.ts).
 */
export function freezeStudioPlan(
  plan: StudioArrangementPlan,
  frozen: ReadonlyMap<string, StudioFrozenLane>,
): StudioArrangementPlan {
  if (!frozen.size) return plan
  return {
    ...plan,
    lanes: plan.lanes.map((lane) => {
      const render = frozen.get(lane.track.id)
      if (!render) return lane
      return {
        ...lane,
        spec: FROZEN_LANE_SPEC,
        segments: frozenSegments(render, plan.startFrame),
        frozen: true,
      }
    }),
  }
}

/**
 * A run's audio: the clips' buffers, and its frozen lanes' chunks, each made
 * into a buffer when the scheduler asks for it. Iterating lists the clips'
 * buffers only, so nothing decodes every chunk at once.
 */
export class StudioFrozenBuffers implements ReadonlyMap<string, AudioBuffer> {
  private readonly chunks = new Map<string, StudioFrozenChunk>()
  private readonly decoded = new Map<string, AudioBuffer>()
  private readonly keep: number

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly base: ReadonlyMap<string, AudioBuffer>,
    lanes: Iterable<StudioFrozenLane>,
  ) {
    let count = 0
    for (const lane of lanes) {
      count++
      for (const chunk of lane.chunks) this.chunks.set(chunk.id, chunk)
    }
    // The chunk playing and the next, per lane; a seek decodes again.
    this.keep = count * 2
  }

  get(id: string): AudioBuffer | undefined {
    return this.base.get(id) ?? this.decode(id)
  }

  has(id: string): boolean {
    return this.base.has(id) || this.chunks.has(id)
  }

  get size(): number {
    return this.base.size
  }

  forEach(
    callback: (
      value: AudioBuffer,
      key: string,
      map: ReadonlyMap<string, AudioBuffer>,
    ) => void,
  ): void {
    this.base.forEach((value, key) => callback(value, key, this))
  }

  entries(): MapIterator<[string, AudioBuffer]> {
    return this.base.entries()
  }

  keys(): MapIterator<string> {
    return this.base.keys()
  }

  values(): MapIterator<AudioBuffer> {
    return this.base.values()
  }

  [Symbol.iterator](): MapIterator<[string, AudioBuffer]> {
    return this.base.entries()
  }

  private decode(id: string): AudioBuffer | undefined {
    const chunk = this.chunks.get(id)
    if (!chunk) return undefined
    const cached = this.decoded.get(id)
    if (cached) return cached
    const buffer = decodeFrozenChunk(this.ctx, chunk)
    this.decoded.set(id, buffer)
    for (const old of this.decoded.keys()) {
      if (this.decoded.size <= this.keep) break
      this.decoded.delete(old)
    }
    return buffer
  }
}

/** Each lane with clips in `project`, by track: its freeze key as the song stands. */
export function laneFreezeKeys(
  project: StudioProject,
  assets: readonly StudioAsset[],
): Map<string, string> {
  const plan = compileStudioArrangement(project, assets)
  return new Map(
    plan.lanes
      .filter((lane) => lane.segments.length > 0)
      .map((lane) => [lane.track.id, laneFreezeKey(lane)]),
  )
}

/** Whether any frozen lane's clips or chain changed in `project`. */
export function freezesOutdated(
  frozen: ReadonlyMap<string, StudioFrozenLane>,
  project: StudioProject,
  assets: readonly StudioAsset[],
): boolean {
  if (!frozen.size) return false
  let keys: Map<string, string>
  try {
    keys = laneFreezeKeys(project, assets)
  } catch {
    return true
  }
  for (const [trackId, lane] of frozen)
    if (keys.get(trackId) !== lane.key) return true
  return false
}

/**
 * Whether any frozen lane's chain sounds different in `project`: a cheaper
 * check than freezesOutdated for an edit that leaves every clip as it was,
 * such as a moving macro dial.
 */
export function frozenSoundChanged(
  frozen: ReadonlyMap<string, StudioFrozenLane>,
  project: StudioProject,
): boolean {
  for (const [trackId, lane] of frozen) {
    const track = project.tracks.find((item) => item.id === trackId)
    if (!track) return true
    const spec = JSON.stringify(studioLaneSpec(track, project.mix.macros))
    if (spec !== lane.spec) return true
  }
  return false
}
