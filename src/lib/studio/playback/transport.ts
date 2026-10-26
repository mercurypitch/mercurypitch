// Studio transport — one borrowed clock, explicit playback intent and generation-owned graph cleanup.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import { closeEnvelope } from '@/lib/preview-player'
import { reserveStudioMemory } from '../memory-budget'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferCache, StudioBufferLease } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import type { StudioGraph } from './graph'
import { buildStudioGraph, studioGraphWorkingBytes } from './graph'
import type { StudioLatencyReader } from './prepare-plan'
import { planAssets, planLatencySeconds, prepareStudioPlan, } from './prepare-plan'

const RELEASE_MS = 240
const WARMUP_SECONDS = 0.5
const LOOKAHEAD_SECONDS = 2
export interface StudioTransportState {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  error: string | null
}
export interface StudioTransportOptions {
  lease: AudioContextLease
  readCanonicalAsset(id: string): Promise<Blob>
  changed(state: StudioTransportState): void
  cache?: StudioBufferCache
  measureLatencies?: StudioLatencyReader
  buildGraph?: typeof buildStudioGraph
}
interface Run {
  ctx: AudioContext
  graph: StudioGraph
  envelope: GainNode
  buffers: StudioBufferLease
  releaseMemory: () => void
  startFrame: number
  endFrame: number
  audibleEpoch: number
  endsAt: number
}

export function createStudioTransport(options: StudioTransportOptions) {
  const cache = options.cache ?? createStudioBufferCache()
  const retired = new Set<Run>()
  const retiredTimers = new Map<Run, ReturnType<typeof setTimeout>>()
  let active: Run | null = null
  let abort: AbortController | null = null
  let preparing = false
  let preparationSettled: (() => void) | null = null
  let preparationDone = Promise.resolve()
  const releasedListeners = new Set<() => void>()
  let disposed = false
  let generation = 0
  let wantsPlayback = false
  let restartGeneration = 0
  let state: StudioTransportState = {
    playing: false,
    pending: false,
    playheadFrame: 0,
    peakL: 0,
    peakR: 0,
    error: null,
  }
  let watchedContext: AudioContext | null = null
  const publish = (update: Partial<StudioTransportState>) => {
    state = { ...state, ...update }
    if (!disposed) options.changed(state)
  }
  const position = (run: Run) =>
    Math.max(
      run.startFrame,
      Math.min(
        run.endFrame,
        run.startFrame +
          Math.floor(
            Math.max(0, run.ctx.currentTime - run.audibleEpoch) * 48000,
          ),
      ),
    )

  function release(run: Run): void {
    run.graph.dispose()
    run.envelope.disconnect()
    run.buffers.release()
    run.releaseMemory()
    retired.delete(run)
    retiredTimers.delete(run)
    if (disposed) cache.dispose()
    if (!retired.size) {
      for (const settled of releasedListeners) settled()
      releasedListeners.clear()
    }
  }

  function retire(): void {
    const run = active
    active = null
    if (!run) return
    retired.add(run)
    if (run.ctx.state !== 'running') {
      release(run)
      return
    }
    closeEnvelope(run.envelope, run.ctx, 0.18)
    retiredTimers.set(
      run,
      setTimeout(() => release(run), RELEASE_MS),
    )
  }

  function pause(preserveIntent = false): void {
    if (!preserveIntent) {
      wantsPlayback = false
      restartGeneration++
    }
    generation++
    abort?.abort()
    if (active) publish({ playheadFrame: position(active) })
    retire()
    publish({ playing: false, pending: preparing, peakL: 0, peakR: 0 })
  }

  function onClockState(): void {
    if (watchedContext?.state !== 'running' && (active || preparing)) {
      pause()
      publish({ error: 'Audio was interrupted. Press Play to continue.' })
      for (const run of [...retired]) {
        clearTimeout(retiredTimers.get(run))
        release(run)
      }
    }
  }

  function watch(ctx: AudioContext): void {
    if (watchedContext === ctx) return
    watchedContext?.removeEventListener('statechange', onClockState)
    watchedContext = ctx
    ctx.addEventListener('statechange', onClockState)
  }

  async function play(
    project: StudioProject,
    assets: readonly StudioAsset[],
    startFrame = state.playheadFrame,
  ): Promise<boolean> {
    if (disposed) return false
    if (preparing) {
      publish({
        error: 'Audio is still preparing. Try Play again in a moment.',
      })
      return false
    }
    wantsPlayback = true
    restartGeneration++
    pause(true)
    const token = ++generation
    const attempt = new AbortController()
    abort = attempt
    preparing = true
    preparationDone = new Promise<void>((resolve) => {
      preparationSettled = resolve
    })
    publish({ pending: true, error: null })
    let buffers: StudioBufferLease | undefined
    let releaseMemory: (() => void) | undefined
    let graph: StudioGraph | undefined
    let envelope: GainNode | undefined
    try {
      // Called immediately by an explicit UI action, before asset reads.
      if (!(await options.lease.unlock()))
        throw new Error('Audio could not start. Press Play to try again.')
      attempt.signal.throwIfAborted()
      const ctx = options.lease.ensure()
      if (!ctx || ctx.state !== 'running')
        throw new Error(
          'The audio device is not ready. Press Play to try again.',
        )
      watch(ctx)
      const content = compileStudioArrangement(project, assets)
      if (
        !content.lanes.some((lane) => lane.audible && lane.segments.length > 0)
      )
        throw new Error('Add an audible take before playing.')
      const from =
        startFrame >= content.endFrame ? 0 : Math.max(0, Math.floor(startFrame))
      releaseMemory = reserveStudioMemory(
        studioGraphWorkingBytes(content, ctx.sampleRate),
      )
      const plan = await prepareStudioPlan(
        project,
        assets,
        ctx.sampleRate,
        from,
        attempt.signal,
        options.measureLatencies,
      )
      buffers = await cache.acquire(
        planAssets(plan, assets),
        ctx,
        options.readCanonicalAsset,
        attempt.signal,
      )
      attempt.signal.throwIfAborted()
      if (token !== generation || disposed)
        throw new DOMException('Playback cancelled', 'AbortError')
      const epoch = ctx.currentTime + WARMUP_SECONDS
      graph = (options.buildGraph ?? buildStudioGraph)(
        ctx,
        plan,
        buffers.buffers,
        epoch,
      )
      envelope = ctx.createGain()
      envelope.gain.value = 0
      const audibleEpoch = epoch + planLatencySeconds(plan)
      envelope.gain.setValueAtTime(0.0001, audibleEpoch)
      envelope.gain.exponentialRampToValueAtTime(1, audibleEpoch + 0.09)
      graph.output.connect(envelope)
      envelope.connect(ctx.destination)
      graph.scheduleUntil(ctx.currentTime + LOOKAHEAD_SECONDS)
      active = {
        ctx,
        graph,
        envelope,
        buffers,
        releaseMemory,
        startFrame: from,
        endFrame: plan.endFrame,
        audibleEpoch,
        endsAt: audibleEpoch + (plan.endFrame - from + plan.tailFrames) / 48000,
      }
      buffers = undefined
      releaseMemory = undefined
      graph = undefined
      envelope = undefined
      publish({ playing: true, pending: false, playheadFrame: from })
      return true
    } catch (error) {
      if (token === generation && !disposed && !attempt.signal.aborted) {
        wantsPlayback = false
        publish({
          pending: false,
          playing: false,
          error:
            error instanceof Error
              ? error.message
              : 'Studio could not play this project.',
        })
      }
      return false
    } finally {
      graph?.dispose()
      envelope?.disconnect()
      buffers?.release()
      releaseMemory?.()
      preparing = false
      if (!active) publish({ pending: false })
      preparationSettled?.()
      preparationSettled = null
      if (abort === attempt) abort = null
    }
  }

  const timer = setInterval(() => {
    const run = active
    if (!run) return
    try {
      run.graph.scheduleUntil(run.ctx.currentTime + LOOKAHEAD_SECONDS)
      const [peakL, peakR] = run.graph.readPeaks()
      publish({ playheadFrame: position(run), peakL, peakR })
      if (run.ctx.currentTime >= run.endsAt) pause()
    } catch (error) {
      pause()
      publish({
        error: error instanceof Error ? error.message : 'Playback stopped.',
      })
    }
  }, 33)

  async function waitForRelease(): Promise<void> {
    await preparationDone
    if (retired.size)
      await new Promise<void>((resolve) => releasedListeners.add(resolve))
  }

  return {
    play,
    pause: () => pause(),
    stop() {
      pause()
      publish({ playheadFrame: 0, error: null })
      cache.clear()
    },
    async releaseAudio(): Promise<void> {
      pause()
      cache.clear()
      await waitForRelease()
      cache.clear()
    },
    async setSnapshot(
      project: StudioProject,
      assets: readonly StudioAsset[],
    ): Promise<void> {
      if (!wantsPlayback || disposed) return
      const token = ++restartGeneration
      const frame = active ? position(active) : state.playheadFrame
      pause(true)
      await waitForRelease()
      if (wantsPlayback && !disposed && token === restartGeneration)
        await play(project, assets, frame)
    },
    async seek(
      frame: number,
      project: StudioProject,
      assets: readonly StudioAsset[],
    ): Promise<void> {
      if (!Number.isSafeInteger(frame) || frame < 0) return
      const wasPlaying = wantsPlayback
      const token = ++restartGeneration
      pause(true)
      const end = compileStudioArrangement(project, assets).endFrame
      publish({ playheadFrame: Math.min(frame, end) })
      if (!wasPlaying || state.playheadFrame >= end) {
        pause()
        return
      }
      await waitForRelease()
      if (wantsPlayback && !disposed && token === restartGeneration)
        await play(project, assets, state.playheadFrame)
    },
    prepareToSuspend() {
      pause()
      return retired.size ? RELEASE_MS : 0
    },
    getState: () => state,
    dispose() {
      if (disposed) return
      pause()
      disposed = true
      clearInterval(timer)
      watchedContext?.removeEventListener('statechange', onClockState)
      watchedContext = null
      cache.dispose()
    },
  }
}

export type StudioTransport = ReturnType<typeof createStudioTransport>
