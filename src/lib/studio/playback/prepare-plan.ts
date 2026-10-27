// Studio playback preparation — measured context-rate latency without changing durable project data.
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { studioGraphLanes } from './graph'

export type StudioLatencyReader = typeof measureTrackLatencies

/**
 * Chain latency depends on which effects there are, not on their settings,
 * so one measurement per effect list and rate serves every later Play, seek
 * and restart.
 */
export function createLatencyCache(
  measure: StudioLatencyReader,
): StudioLatencyReader {
  const latencies = new Map<string, number>()
  return async (specs, rate) => {
    const frames: number[] = []
    for (const spec of specs) {
      const key = `${rate}:${spec.effects.map((effect) => effect.kind).join(',')}`
      let value = latencies.get(key)
      if (value === undefined) {
        ;[value] = await measure([spec], rate)
        latencies.set(key, value)
      }
      frames.push(value)
    }
    return frames
  }
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
