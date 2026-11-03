// ============================================================
// Studio lane render reuse — which held renders an offline job plays
// ============================================================
//
// Export, Compare and auto-balance play the renders the freezer has for the
// song instead of running those lanes' chains again (lane-freezer.ts). A job
// holds what it plays until it is done with it, so the memory budget cannot
// take those renders back meanwhile, as it can a render nobody holds. A
// render is as long as its lane plays; a take only as long as itself. A lane
// that plays the same take again and again holds far more rendered than it
// needs live: a 2 s take repeated across a 5-minute song renders to 58.4 MB,
// against 6.7 to 11.2 MB live (the take decoded, 0.4 MB, and its chain's
// working memory). Six such lanes held on a phone's 512 MiB leave an export
// too little room for its own 280 MB, where live they fit. So a job holds a
// render only while it takes at most twice what its lane needs live. A lane
// that plays each of its takes once stays under that: 58.4 MB rendered
// against 64 to 68 MB live for a 5-minute take, a stereo take about half.
import type { StudioPlannedLane } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { studioChainWorkingBytes } from './graph'
import type { StudioFrozenLane } from './lane-freeze'

/** How much more than its lane needs live a render a job holds may take. */
export const REUSE_MEMORY_FACTOR = 2

/** What playing `lane` live reserves: its takes decoded and its chain's working memory. */
export function liveLaneBytes(
  lane: Pick<StudioPlannedLane, 'segments' | 'spec'>,
  assets: readonly StudioAsset[],
): number {
  const ids = new Set(lane.segments.map((segment) => segment.assetId))
  return assets.reduce(
    (bytes, asset) =>
      ids.has(asset.id)
        ? bytes + asset.normalizedFrameCount * asset.channels * 4
        : bytes,
    studioChainWorkingBytes(lane.spec, STUDIO_SAMPLE_RATE),
  )
}

/** Which renders a job playing `project` should hold: none for a song that does not compile. */
export function rendersWorthHolding(
  project: StudioProject,
  assets: readonly StudioAsset[],
): (trackId: string, render: StudioFrozenLane) => boolean {
  let lanes: Map<string, StudioPlannedLane>
  try {
    lanes = new Map(
      compileStudioArrangement(project, assets).lanes.map((lane) => [
        lane.track.id,
        lane,
      ]),
    )
  } catch {
    return () => false
  }
  return (trackId, render) => {
    const lane = lanes.get(trackId)
    return (
      lane !== undefined &&
      render.bytes <= REUSE_MEMORY_FACTOR * liveLaneBytes(lane, assets)
    )
  }
}
