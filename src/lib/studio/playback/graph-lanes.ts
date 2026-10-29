// ============================================================
// Studio graph lanes — a lane's chain, faders and source sets, kept for as long as its graph plays
// ============================================================
//
// A lane is built once: its chain, the gains for its volume and pan, and the
// merge a lane meter taps. Its sources come and go in sets
// (seek-crossfade.ts) on a timeline of its own (lane-timeline.ts), so a seek
// or a clip edit changes what the lane reads and never what it runs
// through: its effect tails ring on, and every other lane plays on as it was.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioPlannedLane, StudioPlannedSegment, } from '../model/arrangement-plan'
import { studioPanGains } from '../model/arrangement-plan'
import type { StudioTrack } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { scheduleStudioSegmentGain } from './edge-envelope'
import type { StudioLaneTimeline, StudioPlanned, StudioScheduled, } from './lane-timeline'
import { laneCycle, laneTimeline, plannedSegments } from './lane-timeline'
import type { StudioFadeShape, StudioLaneInput, StudioSourceSet, } from './seek-crossfade'
import { closeStudioSourceSet, emptyStudioSourceSet, openStudioSourceSet, retireStudioSourceSet, stopStudioSource, } from './seek-crossfade'

export interface StudioGraphLane {
  readonly trackId: string
  /** Where its sources go, and how much later than the slowest lane they start. */
  readonly feed: StudioLaneInput
  readonly chain: StudioFxChain
  /** Its broadband dynamics, whose reductions add up to the lane's. */
  dynamics: string[]
  /** Left and right fader gains, after the chain. */
  readonly mixes: readonly GainNode[]
  readonly split: ChannelSplitterNode
  /** The lane's output after its faders and pan: what a lane meter taps. */
  readonly merge: ChannelMergerNode
  segments: readonly StudioPlannedSegment[]
  planned: StudioPlanned[]
  timeline: StudioLaneTimeline
  /** The newest set of sources; older ones still fading are in `sets` too. */
  current: StudioSourceSet
  readonly sets: Set<StudioSourceSet>
}

/** The broadband dynamics in a chain, whose reductions add up to the lane's. */
export function dynamicsIds(spec: ChainSpec): string[] {
  return spec.effects
    .filter(
      (effect) =>
        effect.enabled &&
        (effect.kind === 'compressor' || effect.kind === 'limiter'),
    )
    .map((effect) => effect.id)
}

/** Left and right lane gains: pan law times volume and balance. */
export function laneGains(track: StudioTrack): readonly [number, number] {
  const [left, right] = studioPanGains(track.pan)
  const gain = Math.pow(10, (track.gainDb + track.balanceGainDb) / 20)
  return [left * gain, right * gain]
}

/** Where a lane is built and where its first sources play from. */
export interface StudioLanePlace {
  readonly output: AudioNode
  readonly planStart: number
  /** When pass 0's first frame enters a lane with no compensation. */
  readonly passStart: number
  readonly fromFrame: number
}

/** A lane's faders after `chain`, into `output`: split, a gain per side, merge. */
function connectFaders(
  ctx: BaseAudioContext,
  lane: StudioPlannedLane,
  chain: StudioFxChain,
  output: AudioNode,
) {
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  const values = lane.audible ? laneGains(lane.track) : [0, 0]
  const mixes = values.map((value, index) => {
    const gain = ctx.createGain()
    gain.gain.value = value
    split.connect(gain, index)
    gain.connect(merge, 0, index)
    return gain
  })
  chain.output.connect(split)
  merge.connect(output)
  return { split, merge, mixes }
}

/**
 * Build a lane's chain and faders into `place.output`, with Play's set of
 * sources open and its timeline from `place.fromFrame`. When a step fails,
 * the chain it built goes before the error does.
 */
export function buildGraphLane(
  ctx: BaseAudioContext,
  lane: StudioPlannedLane,
  place: StudioLanePlace,
): StudioGraphLane {
  if (lane.compensationSeconds === null)
    throw new Error('Studio chain timing has not been measured.')
  const chain = createStudioFxChain(ctx, lane.spec)
  try {
    const faders = connectFaders(ctx, lane, chain, place.output)
    const feed = { input: chain.input, compensation: lane.compensationSeconds }
    const planned = plannedSegments(
      lane.segments,
      place.planStart,
      feed.compensation,
    )
    const current = openStudioSourceSet(ctx, feed, null)
    return {
      trackId: lane.track.id,
      feed,
      chain,
      dynamics: dynamicsIds(chain.getSpec()),
      ...faders,
      segments: lane.segments,
      planned,
      timeline: laneTimeline(planned, place.passStart, place.fromFrame),
      current,
      sets: new Set([current]),
    }
  } catch (error) {
    chain.dispose()
    throw error
  }
}

/** Take a set's gains out once its last source has ended. */
function closeLaneSet(lane: StudioGraphLane, set: StudioSourceSet): void {
  closeStudioSourceSet(set)
  lane.sets.delete(set)
}

/**
 * Cross a lane from what it plays to a new set of sources at `time`. A set
 * opened for a change not heard yet, at the same time, takes the new
 * sources instead, so a burst of changes schedules one fade.
 */
export function crossLane(
  ctx: BaseAudioContext,
  lane: StudioGraphLane,
  time: number,
  shape: StudioFadeShape,
): void {
  const last = lane.current
  if (last.at === time && time > ctx.currentTime) {
    emptyStudioSourceSet(last)
    return
  }
  if (!retireStudioSourceSet(last, time, shape)) closeLaneSet(lane, last)
  lane.current = openStudioSourceSet(ctx, lane.feed, time, shape)
  lane.sets.add(lane.current)
}

/** Open a set for sources that play at full level from their first frame, as after Play. */
export function openLane(ctx: BaseAudioContext, lane: StudioGraphLane): void {
  lane.current = openStudioSourceSet(ctx, lane.feed, null)
  lane.sets.add(lane.current)
}

/** Start one scheduled source on the lane's newest set. */
function startLaneSource(
  ctx: BaseAudioContext,
  lane: StudioGraphLane,
  { segment, when }: StudioScheduled,
  buffers: ReadonlyMap<string, AudioBuffer>,
): void {
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
  const set = lane.current
  gain.connect(set.fadeOut)
  set.sources.set(source, { gain, pass: lane.timeline.pass, when })
  source.onended = () => {
    source.disconnect()
    gain.disconnect()
    set.sources.delete(source)
    if (set.retired && !set.sources.size) closeLaneSet(lane, set)
  }
  scheduleStudioSegmentGain(gain.gain, segment, when)
  source.start(
    when,
    segment.sourceInFrame / STUDIO_SAMPLE_RATE,
    (segment.sourceOutFrame - segment.sourceInFrame) / STUDIO_SAMPLE_RATE,
  )
}

/** How a lane's schedule runs on: whether it loops, and how long a loop is. */
export interface StudioLaneRun {
  readonly looping: boolean
  readonly cycleSeconds: number
  readonly buffers: ReadonlyMap<string, AudioBuffer>
}

/** Start every source on the lane due by `time`, moving into the next pass while it loops. */
export function scheduleLane(
  ctx: BaseAudioContext,
  lane: StudioGraphLane,
  time: number,
  run: StudioLaneRun,
): void {
  const timeline = lane.timeline
  while (true) {
    if (timeline.next >= timeline.scheduled.length) {
      if (!run.looping || !timeline.cycle.length) return
      timeline.pass++
      const shift = timeline.pass * run.cycleSeconds
      timeline.scheduled = timeline.cycle.map((item) => ({
        ...item,
        when: item.when + shift,
      }))
      timeline.next = 0
    }
    const item = timeline.scheduled[timeline.next]
    if (item.when > time) return
    startLaneSource(ctx, lane, item, run.buffers)
    timeline.next++
  }
}

/**
 * Take back every pass the lane queued after `last`: their sources stop and
 * go, and the lane schedules nothing more of `last`, which it had started in
 * full before it queued the next.
 */
export function dropPassesAfter(lane: StudioGraphLane, last: number): void {
  for (const set of lane.sets) {
    for (const [source, entry] of set.sources) {
      if (entry.pass <= last) continue
      stopStudioSource(source, entry.gain)
      set.sources.delete(source)
    }
    if (set.retired && !set.sources.size) closeLaneSet(lane, set)
  }
  lane.timeline.pass = last
  lane.timeline.scheduled = []
  lane.timeline.next = 0
}

/**
 * Count the lane's passes from `pass`, the one whose first frame entered at
 * `passStart`: it becomes pass 0, and its later passes follow from there.
 */
export function rebaseLane(
  lane: StudioGraphLane,
  pass: number,
  passStart: number,
): void {
  for (const set of lane.sets)
    for (const entry of set.sources.values()) entry.pass -= pass
  lane.timeline.pass -= pass
  lane.timeline.cycle = laneCycle(lane.planned, passStart)
}

/** Stop every source on the lane, playing or waiting, and take its sets out. */
export function silenceLane(lane: StudioGraphLane): void {
  for (const set of lane.sets) {
    emptyStudioSourceSet(set)
    closeStudioSourceSet(set)
  }
  lane.sets.clear()
}

/** Take a lane down: its sources, its chain and its faders. */
export function disposeGraphLane(lane: StudioGraphLane): void {
  silenceLane(lane)
  lane.chain.dispose()
  for (const gain of lane.mixes) gain.disconnect()
  lane.split.disconnect()
  lane.merge.disconnect()
}
