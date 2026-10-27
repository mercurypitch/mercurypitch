// Studio playback preparation — measured context-rate latency without changing durable project data.
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { studioGraphLanes } from './graph'

export type StudioLatencyReader = typeof measureTrackLatencies

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
