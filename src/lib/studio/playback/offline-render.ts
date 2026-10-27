// Studio offline arrangement — the live lane graph rendered with bounded, revision-frozen ownership.
import { reserveStudioMemory } from '../memory-budget'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferLease } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import type { StudioGraph } from './graph'
import { buildStudioGraph, studioGraphWorkingBytes } from './graph'
import type { StudioLatencyReader } from './prepare-plan'
import { planAssets, planLatencySeconds, prepareStudioPlan, } from './prepare-plan'

export interface StudioOfflineOptions {
  signal?: AbortSignal
  createContext?: (options: OfflineAudioContextOptions) => OfflineAudioContext
  measureLatencies?: StudioLatencyReader
}

export interface StudioArrangementRender {
  buffer: AudioBuffer
  projectId: string
  revision: number
  /** Keep this reservation until all encoding/analysis consumers release the buffer. */
  release(): void
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
  const initial = compileStudioArrangement(project, assets)
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
    graph = buildStudioGraph(ctx, plan, lease.buffers, 0.5)
    graph.output.connect(ctx.destination)
    graph.scheduleUntil(Infinity)
    // Native rendering may continue after abort. Keep all reservations until it settles.
    const rendered = await ctx.startRendering()
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
