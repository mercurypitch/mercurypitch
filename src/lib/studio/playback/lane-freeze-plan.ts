// ============================================================
// Studio lane freeze plan — which lanes to render ahead so a song fits the audio thread
// ============================================================
//
// Freezing is for songs that do not fit: while the heard lanes' estimated
// load at the tier the listener wants (Best under Auto) stays over Auto's
// ceiling, the lane whose render lowers it most for the memory it takes is
// frozen next, among the lanes left alone long enough and within the memory
// renders may hold. Lanes rendered already count as frozen, free. When no
// set that fits in memory brings the goal's tier under the ceiling, the
// next tier down is tried, and failing all, the lanes that lighten Light
// most are frozen: Light is then what plays (playback-quality.ts).
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioPlannedLane } from '../model/arrangement-plan'
import { FREEZE_CHUNK_FRAMES, frozenChunkBytes } from './lane-freeze'
import { laneRenderRuns } from './lane-freeze-render'
import { AUTO_LOAD_CEILING } from './playback-quality'
import type { StudioPlaybackTier } from './playback-tiers'
import { PLAYBACK_TIERS } from './playback-tiers'
import { songLoad } from './song-load'

/** A heard lane with clips, as the plan weighs it. */
export interface StudioFreezeCandidate {
  readonly trackId: string
  /** Its chain as it plays live. */
  readonly spec: ChainSpec
  /** What its render will hold, estimated (frozenLaneBytes). */
  readonly bytes: number
  /** Rendered already, for its lane as it is now. */
  readonly ready: boolean
  /** Left alone long enough to render: not being edited. */
  readonly settled: boolean
}

export interface StudioFreezeGoal {
  readonly tier: StudioPlaybackTier
  readonly voiceChainUs: number
  /** What the lanes' renders may hold in all, in bytes. */
  readonly memoryBytes: number
  readonly ceiling?: number
}

const NO_CHAIN: ChainSpec = { version: 1, effects: [] }

function loadWith(
  candidates: readonly StudioFreezeCandidate[],
  frozen: ReadonlySet<string>,
  goal: StudioFreezeGoal,
): number {
  return songLoad(
    candidates.map((lane) => (frozen.has(lane.trackId) ? NO_CHAIN : lane.spec)),
    goal.tier,
    goal.voiceChainUs,
  )
}

/**
 * The lanes to render next, the most useful first: none while the song fits
 * at the goal's tier with the renders it has.
 */
export function chooseLaneFreezes(
  candidates: readonly StudioFreezeCandidate[],
  goal: StudioFreezeGoal,
): string[] {
  const tiers = PLAYBACK_TIERS.slice(PLAYBACK_TIERS.indexOf(goal.tier))
  let lightest: string[] = []
  for (const tier of tiers) {
    const { order, fits } = freezeFor(candidates, { ...goal, tier })
    if (fits) return order
    lightest = order
  }
  return lightest
}

function freezeFor(
  candidates: readonly StudioFreezeCandidate[],
  goal: StudioFreezeGoal,
): { readonly order: string[]; readonly fits: boolean } {
  const ceiling = goal.ceiling ?? AUTO_LOAD_CEILING
  const frozen = new Set(
    candidates.filter((lane) => lane.ready).map((lane) => lane.trackId),
  )
  let used = candidates
    .filter((lane) => lane.ready)
    .reduce((total, lane) => total + lane.bytes, 0)
  const order: string[] = []
  let load = loadWith(candidates, frozen, goal)
  while (load > ceiling) {
    let best: {
      lane: StudioFreezeCandidate
      load: number
      worth: number
    } | null = null
    for (const lane of candidates) {
      if (frozen.has(lane.trackId) || !lane.settled) continue
      if (used + lane.bytes > goal.memoryBytes) continue
      frozen.add(lane.trackId)
      const next = loadWith(candidates, frozen, goal)
      frozen.delete(lane.trackId)
      const worth = (load - next) / Math.max(1, lane.bytes)
      if (!best || worth > best.worth) best = { lane, load: next, worth }
    }
    if (!best || best.load >= load) break
    frozen.add(best.lane.trackId)
    used += best.lane.bytes
    order.push(best.lane.trackId)
    load = best.load
  }
  return { order, fits: load <= ceiling }
}

/**
 * What a lane's render will hold: its clips and the tail after each run of
 * them, in whole chunks. Long silences between clips cost nothing, as
 * silent chunks are left out.
 */
export function frozenLaneBytes(
  lane: Pick<StudioPlannedLane, 'segments' | 'spec'>,
): number {
  // A run starts part-way into a chunk and ends part-way into another.
  const chunks = laneRenderRuns(lane).reduce(
    (sum, run) => sum + Math.ceil(run.length / FREEZE_CHUNK_FRAMES),
    0,
  )
  return chunks * frozenChunkBytes(FREEZE_CHUNK_FRAMES)
}
