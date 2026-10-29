// Studio playback preparation — measured context-rate latency without changing durable project data.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import { prepareStudioLiveMeter } from '../metering/live-meter'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { studioGraphLanes } from './graph'

export type StudioLatencyReader = typeof measureTrackLatencies

/** A latency reader that remembers what it measured, and tells it without waiting. */
export type StudioLatencyCache = StudioLatencyReader & {
  /** A chain's latency in frames at `rate`, when measured before. */
  readonly known: (spec: ChainSpec, rate: number) => number | undefined
}

/**
 * Chain latency depends on which effects there are, not on their settings,
 * so one measurement per effect list and rate serves every later Play, seek,
 * restart and chain swap.
 */
export function createLatencyCache(
  measure: StudioLatencyReader,
): StudioLatencyCache {
  const latencies = new Map<string, number>()
  const keyOf = (spec: ChainSpec, rate: number) =>
    `${rate}:${spec.effects.map((effect) => effect.kind).join(',')}`
  const read: StudioLatencyReader = async (specs, rate) => {
    const frames: number[] = []
    for (const spec of specs) {
      const key = keyOf(spec, rate)
      let value = latencies.get(key)
      if (value === undefined) {
        ;[value] = await measure([spec], rate)
        latencies.set(key, value)
      }
      frames.push(value)
    }
    return frames
  }
  return Object.assign(read, {
    known: (spec: ChainSpec, rate: number) => latencies.get(keyOf(spec, rate)),
  })
}

/**
 * The plan with each lane's chain latency measured at this rate. With
 * `silentLanes`, the muted lanes with clips are measured and aligned too,
 * so a graph built with them can bring one in while it plays.
 */
export async function prepareStudioPlan(
  project: StudioProject,
  assets: readonly StudioAsset[],
  sampleRate: number,
  startFrame: number,
  signal: AbortSignal,
  measure: StudioLatencyReader = measureTrackLatencies,
  silentLanes = false,
): Promise<StudioArrangementPlan> {
  const base = compileStudioArrangement(project, assets, { startFrame })
  const lanes = base.lanes.filter(
    (lane) => lane.audible || (silentLanes && lane.segments.length > 0),
  )
  signal.throwIfAborted()
  const frames: number[] = []
  const measured = new Map<string, number>()
  for (const lane of lanes) {
    signal.throwIfAborted()
    const key = lane.spec.effects.map((effect) => effect.kind).join(',')
    let latency = measured.get(key)
    if (latency === undefined) {
      ;[latency] = await measure([lane.spec], sampleRate)
      signal.throwIfAborted()
      measured.set(key, latency)
    }
    frames.push(latency)
  }
  return compileStudioArrangement(project, assets, {
    startFrame,
    latencies: {
      sampleRate,
      framesByTrack: Object.fromEntries(
        lanes.map((lane, index) => [lane.track.id, frames[index]]),
      ),
    },
  })
}

/**
 * Load the live meter's worklet on `ctx` and measure the master chain there:
 * its latency in seconds, which every lane's clips are heard after.
 */
export async function prepareStudioMaster(
  ctx: AudioContext,
  spec: ChainSpec,
  signal: AbortSignal,
  measure: StudioLatencyReader,
): Promise<number> {
  await prepareStudioLiveMeter(ctx)
  signal.throwIfAborted()
  const [frames] = await measure([spec], ctx.sampleRate)
  signal.throwIfAborted()
  if (!Number.isSafeInteger(frames) || frames < 0)
    throw new Error('Studio master timing could not be measured.')
  return frames / ctx.sampleRate
}

export function planLatencySeconds(plan: StudioArrangementPlan): number {
  return Math.max(0, ...plan.lanes.map((lane) => lane.chainLatencySeconds ?? 0))
}

/** The audio the graph's lanes play; `silentLanes` as for buildStudioGraph. */
export function planAssets(
  plan: StudioArrangementPlan,
  assets: readonly StudioAsset[],
  silentLanes = false,
): StudioAsset[] {
  const ids = new Set(
    studioGraphLanes(plan, silentLanes).flatMap((lane) =>
      lane.segments.map((segment) => segment.assetId),
    ),
  )
  return assets.filter((asset) => ids.has(asset.id))
}

/** Where a run from `frame` starts: at the top once the song has ended there. */
export function studioFirstFrame(endFrame: number, frame: number): number {
  return frame >= endFrame ? 0 : Math.max(0, Math.floor(frame))
}

/**
 * Where a run asked to start at `startFrame` begins. Throws when nothing
 * would sound, or when a song too short to loop is set to repeat.
 */
export function playableStudioFrom(
  project: StudioProject,
  assets: readonly StudioAsset[],
  startFrame: number,
  repeat: boolean,
): number {
  const content = compileStudioArrangement(project, assets)
  if (!content.lanes.some((lane) => lane.audible && lane.segments.length > 0))
    throw new Error('Add an audible take before playing.')
  if (repeat && content.endFrame < 12000)
    throw new Error('A song needs at least a quarter second to repeat.')
  return studioFirstFrame(content.endFrame, startFrame)
}
