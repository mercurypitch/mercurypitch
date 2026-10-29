// ============================================================
// Studio graph swap — a lane's new effect list gets a chain built beside the old one, and the lane crosses to it at the chain outputs
// ============================================================
//
// A lane's chain is built from its effect list, so another list (a new
// sound role, mostly) needs another chain. That used to hand the whole song
// to a newly built graph (handoff.ts): every lane's chain started again,
// its reverb and delay tails with it, and every lane went through the
// handover's crossfade. A swap builds only the edited lane's new chain,
// beside the old one, into the lane's faders through a gain of its own at
// zero. The lane's sources go to the new chain from the first whole frame
// they can reach, aligned by the new chain's latency, while the old chain
// plays on; then the two outputs cross linearly over 30 ms, before the
// lane's faders, so its meter keeps its tap. Both are the same audio on the
// same frames, as in a handover. Every other lane plays on untouched.
//
// The new chain is heard no sooner than CHAIN_SETTLE_SECONDS after it is
// built. A compressor-based effect starts far below its settled level and
// comes up as its release runs. Built from silence in headless Chromium,
// with a tone in from 15 ms, the voice chain read 14 dB under its settled
// level at 0.1 s, 1.5 dB under at 0.2 s and none at 0.25 s; the drum bus
// 3.3, 0.4 and 0.05 dB. By 0.3 s no role was more than 0.1 dB under but the
// piano, 0.5 dB under while its hall filled: a new chain's reverb and delay
// hold only what the lane fed them since the swap, and nothing helps that.
// Keys and backing vocals start over their settled level instead (1.2 dB
// at 0.3 s), as they do in any newly built run.
//
// What a swap cannot do goes to a new run (handoff.ts), each for a reason
// of its own: a chain slower than the slowest lane, which every other lane
// would have to wait for; a lane the graph did not build; a graph parked
// or played out; and a swap still crossing, during which the graph also
// refuses to seek or re-plan.
import type { StudioFxChain } from '@/lib/studio-fx/chain'
import { createStudioFxChain } from '@/lib/studio-fx/chain'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { StudioGraphLane } from './graph-lanes'
import { disposeRetiringChain, dynamicsIds, retireLaneSet, scheduleLane, } from './graph-lanes'
import type { StudioGraphState } from './graph-passes'
import { laneRun, passStart, swapping } from './graph-passes'
import type { ReplanPlace } from './graph-replan'
import { rebase, replanPlace } from './graph-replan'
import { laneTimeline, plannedSegments } from './lane-timeline'
import { EQUAL_POWER_FADE, openStudioSourceSet, SAME_AUDIO_CROSSFADE_SECONDS, SEEK_CROSSFADE_SECONDS, } from './seek-crossfade'

/** How long after it is built a new chain starts to be heard: its compressors have settled by then. */
export const CHAIN_SETTLE_SECONDS = 0.3

/** A lane's new chain: what it is built from, how late it is, and the memory it holds. */
export interface StudioChainSwap {
  readonly trackId: string
  readonly spec: ChainSpec
  /** Its measured latency in seconds, at the graph's rate. */
  readonly latency: number
  /** Frees the memory reserved for it; called once it goes. */
  readonly release: () => void
}

/** A new chain, built into its lane's faders through a gain still at zero. */
interface BuiltChain {
  readonly chain: StudioFxChain
  readonly fade: GainNode
}

/** Take down chains built for a swap that does not happen. */
function dropChains(built: readonly BuiltChain[]): void {
  for (const { chain, fade } of built) {
    fade.disconnect()
    chain.dispose()
  }
}

/** Build each new chain into its lane, silent. When one fails, the ones built go too. */
function buildChains(
  state: StudioGraphState,
  lanes: readonly StudioGraphLane[],
  swaps: readonly StudioChainSwap[],
): BuiltChain[] | null {
  const built: BuiltChain[] = []
  try {
    for (const [index, swap] of swaps.entries()) {
      const chain = createStudioFxChain(state.ctx, swap.spec)
      const fade = state.ctx.createGain()
      fade.gain.value = 0
      chain.output.connect(fade)
      fade.connect(lanes[index].split)
      built.push({ chain, fade })
    }
    return built
  } catch {
    dropChains(built)
    return null
  }
}

/**
 * Cross `lane` to `next` (see the header): the new chain reads from
 * `place`, and its output comes in over the old one's from `at`.
 */
function crossChains(
  state: StudioGraphState,
  lane: StudioGraphLane,
  next: BuiltChain,
  swap: StudioChainSwap,
  place: ReplanPlace,
  at: number,
): void {
  const end = at + SAME_AUDIO_CROSSFADE_SECONDS
  // The old chain is fed until its output has faded out, then its sources go.
  scheduleLane(state.ctx, lane, end, laneRun(state))
  retireLaneSet(lane, lane.current, end - state.slowest, EQUAL_POWER_FADE)
  lane.fade.gain.setValueAtTime(1, at)
  lane.fade.gain.linearRampToValueAtTime(0, end)
  next.fade.gain.setValueAtTime(0, at)
  next.fade.gain.linearRampToValueAtTime(1, end)
  lane.retiring = {
    chain: lane.chain,
    fade: lane.fade,
    feed: lane.feed,
    release: lane.release,
    at,
    balanceDb: lane.balanceDb,
    silentAt: end + SEEK_CROSSFADE_SECONDS,
  }
  lane.chain = next.chain
  lane.fade = next.fade
  lane.release = swap.release
  lane.feed = {
    input: next.chain.input,
    compensation: Math.max(0, state.slowest - swap.latency),
  }
  lane.dynamics = dynamicsIds(next.chain.getSpec())
  lane.planned = plannedSegments(
    lane.segments,
    state.planStart,
    lane.feed.compensation,
  )
  lane.current = openStudioSourceSet(
    state.ctx,
    lane.feed,
    place.at,
    EQUAL_POWER_FADE,
  )
  lane.sets.add(lane.current)
  lane.timeline = laneTimeline(lane.planned, passStart(state), place.frame)
}

/** The lanes `swaps` name, in order; null when the graph did not build one. */
function lanesOf(
  state: StudioGraphState,
  swaps: readonly StudioChainSwap[],
): StudioGraphLane[] | null {
  const lanes: StudioGraphLane[] = []
  for (const swap of swaps) {
    const lane = state.lanes.find((item) => item.trackId === swap.trackId)
    if (!lane) return null
    lanes.push(lane)
  }
  return lanes
}

/** Take down each chain a swap crossed away from, once its output has faded out. */
export function settleSwaps(state: StudioGraphState): void {
  const now = state.ctx.currentTime
  for (const lane of state.lanes)
    if (lane.retiring && now >= lane.retiring.silentAt)
      disposeRetiringChain(lane)
}

/** End every swap now, as the graph parks: each new chain plays alone, at unity. */
export function finishSwaps(state: StudioGraphState): void {
  for (const lane of state.lanes) {
    if (!lane.retiring) continue
    disposeRetiringChain(lane)
    lane.fade.gain.cancelScheduledValues(0)
    lane.fade.gain.value = 1
  }
}

/**
 * Cross each lane `swaps` names to a new chain of its spec; see the header.
 * Returns when the new chains start to be heard. Null, with nothing
 * changed, when the graph cannot.
 */
export function swapChains(
  state: StudioGraphState,
  swaps: readonly StudioChainSwap[],
  earliest: number,
): number | null {
  if (state.disposed || state.parked || swaps.length === 0) return null
  settleSwaps(state)
  if (swapping(state)) return null
  const lanes = lanesOf(state, swaps)
  const halfFrame = 0.5 / state.ctx.sampleRate
  if (!lanes || swaps.some((swap) => swap.latency > state.slowest + halfFrame))
    return null
  if (!replanPlace(state, earliest)) return null
  // Building a chain holds the main thread while the clock runs on: 1.4 to
  // 41 ms for a role chain in headless Chromium, keys 9.7 to 15.6, against a
  // device callback and 5 ms ahead. A source started at a time gone by
  // starts late, its lane out of line from then on. So the new sources'
  // place is taken once the chains are built, as far ahead of the clock as
  // `earliest` was.
  const asked = state.ctx.currentTime
  const built = buildChains(state, lanes, swaps)
  if (!built) return null
  const place = replanPlace(state, earliest + state.ctx.currentTime - asked)
  if (!place) {
    dropChains(built)
    return null
  }
  rebase(state, place.pass)
  const at = Math.max(
    state.ctx.currentTime + CHAIN_SETTLE_SECONDS,
    place.at + state.slowest + SEEK_CROSSFADE_SECONDS,
  )
  for (const [index, lane] of lanes.entries())
    crossChains(state, lane, built[index], swaps[index], place, at)
  state.pendingAt = Math.max(state.pendingAt, place.at)
  return at
}
