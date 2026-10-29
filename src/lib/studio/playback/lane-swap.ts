// ============================================================
// Studio lane swap — a playing run takes a lane's new effect list on its own graph, with a new chain for that lane alone
// ============================================================
//
// A new effect list on a lane, a new sound role mostly, used to need a new
// run: a whole graph built beside the one playing, and a 30 ms handover
// (handoff.ts) that every lane went through, each chain's tail cut short.
// The run's own graph now builds only that lane's new chain beside the old
// one and crosses the lane to it (graph-swap.ts); every other lane plays on.
// The lane's sources are aligned by the new chain's latency, so that must
// be known first: the transport measures a new effect list
// (measureNewChains) before it follows the edit, and the swap never waits.
// Each new chain holds memory, reserved here as a run reserves its graph's,
// until the chain goes.
//
// What a swap cannot do goes to a new run as before, each for its own
// reason: clips that changed along with the effect list, a latency that
// could not be measured, memory the budget cannot spare, and whatever the
// graph refuses (graph-swap.ts).
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { reserveStudioMemory, StudioMemoryError } from '../memory-budget'
import { studioLaneSpec } from '../model/arrangement-plan'
import type { StudioProject } from '../model/types'
import { studioChainWorkingBytes } from './graph'
import { changedChains, sameClips } from './live-edit'
import type { StudioLatencyCache } from './prepare-plan'
import type { StudioRun } from './run'
import { RUN_LOOKAHEAD_SECONDS } from './run'
import { seekEarliest } from './seek'

/** A chain's measured latency in frames at `rate`, or undefined before it is measured. */
export type StudioKnownLatency = (
  spec: ChainSpec,
  rate: number,
) => number | undefined

interface NewChain {
  readonly trackId: string
  readonly spec: ChainSpec
}

/** The chains `project` builds anew on lanes the run's graph built: another effect list on each. */
function newChains(run: StudioRun, project: StudioProject): NewChain[] {
  const changed = new Set(changedChains(run.graph, run.project, project))
  return project.tracks
    .filter((track) => changed.has(track.id))
    .map((track) => ({
      trackId: track.id,
      spec: studioLaneSpec(track, project.mix.macros),
    }))
}

/**
 * Measure the effect lists `project` brings to lanes the run's graph built,
 * so that their swap need not wait. Null, at once, when there is none it
 * does not know already, so an edit that needs no measuring is followed in
 * the same call. Otherwise true once measured, and false when the measuring
 * failed, which a new run then reports.
 */
export function measureNewChains(
  run: StudioRun,
  project: StudioProject,
  measure: StudioLatencyCache,
): Promise<boolean> | null {
  const rate = run.ctx.sampleRate
  const specs = newChains(run, project)
    .map(({ spec }) => spec)
    .filter((spec) => measure.known(spec, rate) === undefined)
  if (specs.length === 0) return null
  return measure(specs, rate).then(
    () => true,
    () => false,
  )
}

/** Each new chain's latency in seconds, or null when one is not measured. */
function latenciesOf(
  chains: readonly NewChain[],
  rate: number,
  known: StudioKnownLatency,
): number[] | null {
  const seconds: number[] = []
  for (const { spec } of chains) {
    const frames = known(spec, rate)
    if (frames === undefined || !Number.isSafeInteger(frames) || frames < 0)
      return null
    seconds.push(frames / rate)
  }
  return seconds
}

/** A memory reservation for each new chain, or null when they do not all fit. */
function reserveChains(
  chains: readonly NewChain[],
  rate: number,
): (() => void)[] | null {
  const releases: (() => void)[] = []
  try {
    for (const { spec } of chains)
      releases.push(reserveStudioMemory(studioChainWorkingBytes(spec, rate)))
    return releases
  } catch (error) {
    for (const release of releases) release()
    if (error instanceof StudioMemoryError) return null
    throw error
  }
}

/**
 * Cross each lane whose effect list `project` changes to a new chain, on
 * the run's own graph, with the clips as they are. The mix, the sound and
 * Repeat are the caller's. False, with the run as it was, when it cannot.
 */
export function swapLanes(
  run: StudioRun,
  project: StudioProject,
  known: StudioKnownLatency,
): boolean {
  if (!sameClips(run.project, project)) return false
  const rate = run.ctx.sampleRate
  const chains = newChains(run, project)
  const latencies = latenciesOf(chains, rate, known)
  if (chains.length === 0 || !latencies) return false
  const releases = reserveChains(chains, rate)
  if (!releases) return false
  const swaps = chains.map((chain, index) => ({
    ...chain,
    latency: latencies[index],
    release: releases[index],
  }))
  if (run.graph.swapChains(swaps, seekEarliest(run.ctx)) === null) {
    for (const release of releases) release()
    return false
  }
  run.graph.scheduleUntil(run.ctx.currentTime + RUN_LOOKAHEAD_SECONDS)
  return true
}
