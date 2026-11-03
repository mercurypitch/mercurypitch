// Studio offline arrangement — the live lane graph rendered with bounded, revision-frozen ownership.
//
// A lane rendered ahead (lane-freezer.ts) whose render still matches the
// song plays that render here as a run plays it: through an empty chain,
// under its own faders. The render then runs only the chains no render
// matches, and reads none of a frozen lane's takes. A render's chunks
// become buffers only as the render nears them, a few seconds ahead, so
// they never all sit in memory as audio at once.
import { reserveStudioMemory } from '../memory-budget'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import type { StudioGraph } from './graph'
import { buildStudioGraph, studioGraphWorkingBytes } from './graph'
import { studioPlanAutomated } from './lane-automation'
import type { StudioFrozenLane } from './lane-freeze'
import { freezeStudioPlan, laneFreezeKeys, StudioFrozenBuffers, } from './lane-freeze'
import type { StudioLatencyReader } from './prepare-plan'
import { NO_FREEZES, planAssets, planLatencySeconds, prepareStudioPlan, } from './prepare-plan'

export interface StudioOfflineOptions {
  signal?: AbortSignal
  createContext?: (options: OfflineAudioContextOptions) => OfflineAudioContext
  measureLatencies?: StudioLatencyReader
  /**
   * Lanes rendered ahead, by track (lane-freezer.ts `hold`). A lane plays
   * its render only while the render matches the lane as the project has
   * it; the caller holds them until this render settles.
   */
  frozen?: ReadonlyMap<string, StudioFrozenLane>
}

export interface StudioArrangementRender {
  buffer: AudioBuffer
  projectId: string
  revision: number
  /** Keep this reservation until all encoding/analysis consumers release the buffer. */
  release(): void
}

/** How far ahead of the render a graph playing renders is scheduled, and how often the render stops to schedule more. */
const AHEAD_SECONDS = 4
const STEP_SECONDS = 2

/** The renders in `frozen` that match `project`'s lanes as they stand. */
function matchingFreezes(
  project: StudioProject,
  assets: readonly StudioAsset[],
  frozen: ReadonlyMap<string, StudioFrozenLane> | undefined,
): ReadonlyMap<string, StudioFrozenLane> {
  if (frozen === undefined || frozen.size === 0) return NO_FREEZES
  const keys = laneFreezeKeys(project, assets)
  const matching = new Map(
    [...frozen].filter(([trackId, lane]) => keys.get(trackId) === lane.key),
  )
  return matching.size ? matching : NO_FREEZES
}

/**
 * Render `graph`, scheduling it as the render reaches it, the way a run is
 * scheduled as it plays. A failure to schedule fails the render once it
 * has settled; the context is never left suspended.
 */
async function renderAsScheduled(
  ctx: OfflineAudioContext,
  graph: StudioGraph,
  seconds: number,
  signal: AbortSignal,
): Promise<AudioBuffer> {
  const failures: unknown[] = []
  graph.scheduleUntil(AHEAD_SECONDS)
  for (let at = STEP_SECONDS; at < seconds; at += STEP_SECONDS) {
    ctx
      .suspend(at)
      .then(() => {
        try {
          if (!failures.length && !signal.aborted)
            graph.scheduleUntil(at + AHEAD_SECONDS)
        } catch (error) {
          failures.push(error)
        }
        return ctx.resume()
      })
      .catch((error: unknown) => failures.push(error))
  }
  const rendered = await ctx.startRendering()
  if (failures.length) throw failures[0]
  return rendered
}

/** This is the arrangement bus, not a mastered/export-verified deliverable. */
export async function renderStudioArrangement(
  project: StudioProject,
  assets: readonly StudioAsset[],
  read: (id: string) => Promise<Blob>,
  options: StudioOfflineOptions = {},
): Promise<StudioArrangementRender> {
  const signal = options.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const frozen = matchingFreezes(project, assets, options.frozen)
  const initial = freezeStudioPlan(
    compileStudioArrangement(project, assets),
    frozen,
  )
  const releaseGraph = reserveStudioMemory(
    studioGraphWorkingBytes(initial, 48000),
  )
  const cache = createStudioBufferCache()
  let lease: StudioBufferLease | undefined
  let graph: StudioGraph | undefined
  let releaseOutput: (() => void) | undefined
  let releaseResult: (() => void) | undefined
  try {
    const plan = await prepareStudioPlan(
      project,
      assets,
      48000,
      0,
      signal,
      options.measureLatencies,
      false,
      frozen,
    )
    const length = plan.endFrame + plan.tailFrames
    const trim = 24000 + Math.round(planLatencySeconds(plan) * 48000)
    const total = trim + length
    if (!Number.isSafeInteger(total) || length <= 0 || total > 0xffffffff)
      throw new Error('This arrangement is too long to render.')
    releaseOutput = reserveStudioMemory(total * 2 * 4)
    releaseResult = reserveStudioMemory(length * 2 * 4)
    signal.throwIfAborted()
    const ctx = (
      options.createContext ?? ((init) => new OfflineAudioContext(init))
    )({ numberOfChannels: 2, sampleRate: 48000, length: total })
    lease = await cache.acquire(planAssets(plan, assets), ctx, read, signal)
    signal.throwIfAborted()
    const buffers = frozen.size
      ? new StudioFrozenBuffers(ctx, lease.buffers, frozen.values())
      : lease.buffers
    graph = buildStudioGraph(ctx, plan, buffers, 0.5)
    graph.output.connect(ctx.destination)
    // Native rendering may continue after abort. Keep all reservations until it settles.
    let rendered: AudioBuffer
    // A lane's line, like a render's chunks, is written as the render nears it.
    if (frozen.size || studioPlanAutomated(plan)) {
      rendered = await renderAsScheduled(ctx, graph, total / 48000, signal)
    } else {
      graph.scheduleUntil(Infinity)
      rendered = await ctx.startRendering()
    }
    signal.throwIfAborted()
    const output = ctx.createBuffer(2, length, 48000)
    for (let channel = 0; channel < 2; channel++)
      output.copyToChannel(
        rendered.getChannelData(channel).subarray(trim, trim + length),
        channel,
      )
    const result = {
      buffer: output,
      projectId: plan.projectId,
      revision: plan.revision,
      release: releaseResult,
    }
    releaseResult = undefined
    return result
  } finally {
    graph?.dispose()
    lease?.release()
    cache.dispose()
    releaseOutput?.()
    releaseResult?.()
    releaseGraph()
  }
}
