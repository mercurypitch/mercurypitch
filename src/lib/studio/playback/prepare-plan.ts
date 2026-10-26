// Studio playback preparation — measured context-rate latency without changing durable project data.
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'

export type StudioLatencyReader = typeof measureTrackLatencies

export async function prepareStudioPlan(
  project: StudioProject,
  assets: readonly StudioAsset[],
  sampleRate: number,
  startFrame: number,
  signal: AbortSignal,
  measure: StudioLatencyReader = measureTrackLatencies,
): Promise<StudioArrangementPlan> {
  const base = compileStudioArrangement(project, assets, { startFrame })
  const lanes = base.lanes.filter((lane) => lane.audible)
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

export function planAssets(
  plan: StudioArrangementPlan,
  assets: readonly StudioAsset[],
): StudioAsset[] {
  const ids = new Set(
    plan.lanes
      .filter((lane) => lane.audible)
      .flatMap((lane) => lane.segments.map((segment) => segment.assetId)),
  )
  return assets.filter((asset) => ids.has(asset.id))
}
