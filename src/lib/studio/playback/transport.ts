// Studio transport — one borrowed clock, explicit playback intent and generation-owned graph cleanup.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import { closeEnvelope } from '@/lib/preview-player'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import type { StudioMasterGainToken } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { reserveStudioMemory } from '../memory-budget'
import { createStudioLiveMeter, prepareStudioLiveMeter, } from '../metering/live-meter'
import type { StudioMeterSnapshot } from '../metering/stream-meter'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferCache, StudioBufferLease } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import type { StudioGraph } from './graph'
import { buildStudioGraph, studioGraphWorkingBytes } from './graph'
import type { StudioLatencyReader } from './prepare-plan'
import { planAssets, planLatencySeconds, prepareStudioPlan, } from './prepare-plan'

const RELEASE_MS = 240
// Lead time between building the graph and its first sound. It follows how
// long the last build took, so a fast machine starts in about a tenth of a
// second and a slow one still schedules ahead of its clock.
const MIN_WARMUP_SECONDS = 0.1
const MAX_WARMUP_SECONDS = 0.5
const LOOKAHEAD_SECONDS = 2
export interface StudioTransportState {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  error: string | null
  meter: StudioMeterSnapshot | null
  masterReady: boolean
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
  meter: ReturnType<typeof createStudioLiveMeter>
  buffers: StudioBufferLease
  releaseMemory: () => void
  startFrame: number
  endFrame: number
  audibleEpoch: number
  endsAt: number
  repeat: boolean
}

export function createStudioTransport(options: StudioTransportOptions) {
  const cache = options.cache ?? createStudioBufferCache()
  // Chain latency depends on which effects there are, not on their settings,
  // so one measurement per effect list serves every later Play and seek.
  const latencies = new Map<string, number>()
  const measureLatencies: StudioLatencyReader = async (specs, rate) => {
    const frames: number[] = []
    for (const spec of specs) {
      const key = `${rate}:${spec.effects.map((effect) => effect.kind).join(',')}`
      let value = latencies.get(key)
      if (value === undefined) {
        ;[value] = await (options.measureLatencies ?? measureTrackLatencies)(
          [spec],
          rate,
        )
        latencies.set(key, value)
      }
      frames.push(value)
    }
    return frames
  }
  let buildSeconds = 0.1
  let warming: Promise<void> = Promise.resolve()
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
  let repeat = false
  let masterGain: StudioMasterGainToken | null = null
  let restartGeneration = 0
  let state: StudioTransportState = {
    playing: false,
    pending: false,
    playheadFrame: 0,
    peakL: 0,
    peakR: 0,
    error: null,
    meter: null,
    masterReady: false,
  }
  let watchedContext: AudioContext | null = null
  const publish = (update: Partial<StudioTransportState>) => {
    state = { ...state, ...update }
    if (!disposed) options.changed(state)
  }
  const position = (run: Run) => {
    const frame =
      run.startFrame +
      Math.floor(Math.max(0, run.ctx.currentTime - run.audibleEpoch) * 48000)
    return run.repeat ? frame % run.endFrame : Math.min(run.endFrame, frame)
  }

  function observeSnapshot(project: StudioProject): void {
    if (
      masterGain &&
      (masterGain.projectId !== project.id ||
        masterGain.revision !== project.revision)
    )
      masterGain = null
    publish({ masterReady: masterGain !== null })
  }

  function release(run: Run): void {
    run.meter?.dispose()
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
    publish({
      playing: false,
      pending: preparing,
      peakL: 0,
      peakR: 0,
      meter: null,
    })
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

  async function unlockContext(signal: AbortSignal): Promise<AudioContext> {
    if (!(await options.lease.unlock()))
      throw new Error('Audio could not start. Press Play to try again.')
    signal.throwIfAborted()
    const ctx = options.lease.ensure()
    if (!ctx || ctx.state !== 'running')
      throw new Error('The audio device is not ready. Press Play to try again.')
    watch(ctx)
    return ctx
  }

  function playableContent(
    project: StudioProject,
    assets: readonly StudioAsset[],
    startFrame: number,
  ) {
    const content = compileStudioArrangement(project, assets)
    if (!content.lanes.some((lane) => lane.audible && lane.segments.length > 0))
      throw new Error('Add an audible take before playing.')
    const from =
      startFrame >= content.endFrame ? 0 : Math.max(0, Math.floor(startFrame))
    if (repeat && content.endFrame < 12000)
      throw new Error('A song needs at least a quarter second to repeat.')
    return { content, from }
  }

  async function prepareMaster(
    ctx: AudioContext,
    spec: ChainSpec,
    signal: AbortSignal,
  ): Promise<number> {
    await prepareStudioLiveMeter(ctx)
    signal.throwIfAborted()
    const [frames] = await measureLatencies([spec], ctx.sampleRate)
    signal.throwIfAborted()
    if (!Number.isSafeInteger(frames) || frames < 0)
      throw new Error('Studio master timing could not be measured.')
    return frames / ctx.sampleRate
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
    let meter: ReturnType<typeof createStudioLiveMeter> = null
    try {
      // Called immediately by an explicit UI action, before asset reads.
      const ctx = await unlockContext(attempt.signal)
      observeSnapshot(project)
      const { content, from } = playableContent(project, assets, startFrame)
      const sound = resolveStudioSoundGraph(project, masterGain ?? undefined)
      releaseMemory = reserveStudioMemory(
        studioGraphWorkingBytes(content, ctx.sampleRate, sound.full),
      )
      // A background warm-up does the same reads; wait for it, not around it.
      await warming
      attempt.signal.throwIfAborted()
      const masterLatency = await prepareMaster(ctx, sound.full, attempt.signal)
      const plan = await prepareStudioPlan(
        project,
        assets,
        ctx.sampleRate,
        repeat ? 0 : from,
        attempt.signal,
        measureLatencies,
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
      const built = performance.now()
      const epoch =
        ctx.currentTime +
        Math.min(
          MAX_WARMUP_SECONDS,
          Math.max(MIN_WARMUP_SECONDS, buildSeconds * 2 + 0.04),
        )
      const audibleEpoch = epoch + planLatencySeconds(plan) + masterLatency
      graph = (options.buildGraph ?? buildStudioGraph)(
        ctx,
        plan,
        buffers.buffers,
        epoch,
        true,
        repeat ? from : undefined,
        { spec: sound.full },
      )
      envelope = ctx.createGain()
      envelope.gain.value = 0
      envelope.gain.setValueAtTime(0.0001, audibleEpoch)
      envelope.gain.exponentialRampToValueAtTime(1, audibleEpoch + 0.09)
      graph.output.connect(envelope)
      envelope.connect(ctx.destination)
      meter = createStudioLiveMeter(ctx, envelope, audibleEpoch)
      graph.scheduleUntil(ctx.currentTime + LOOKAHEAD_SECONDS)
      buildSeconds = (performance.now() - built) / 1000
      active = {
        ctx,
        graph,
        envelope,
        meter,
        buffers,
        releaseMemory,
        startFrame: from,
        endFrame: plan.endFrame,
        audibleEpoch,
        endsAt: repeat
          ? Infinity
          : audibleEpoch + (plan.endFrame - from + plan.tailFrames) / 48000,
        repeat,
      }
      buffers = undefined
      releaseMemory = undefined
      graph = undefined
      envelope = undefined
      meter = null
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
      meter?.dispose()
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
      const meter = run.meter?.read() ?? null
      const [peakL, peakR] = meter
        ? [meter.peakL, meter.peakR]
        : run.graph.readPeaks()
      publish({
        playheadFrame: position(run),
        peakL,
        peakR,
        meter,
      })
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

  /**
   * Read the song's audio and measure its chains before anyone presses Play,
   * so the press only builds the graph. Best effort: a failure here is
   * reported, if at all, by the Play that needs the same work.
   */
  function warm(
    project: StudioProject,
    assets: readonly StudioAsset[],
  ): Promise<void> {
    // A function, so each check reads the state after the awaits before it.
    const busy = () => disposed || preparing || active !== null
    if (busy()) return warming
    const run = warming.then(async () => {
      if (busy()) return
      // Before the first gesture the app has no AudioContext yet. Buffers are
      // not tied to one, and the device rate is one of the two common ones.
      const live = options.lease.ensure()
      const factory =
        live ??
        (typeof OfflineAudioContext === 'undefined'
          ? null
          : new OfflineAudioContext(1, 1, 48000))
      if (!factory) return
      const rates = live ? [live.sampleRate] : [48000, 44100]
      const signal = new AbortController().signal
      try {
        playableContent(project, assets, 0)
        if (live) await prepareStudioLiveMeter(live)
        const plans: Awaited<ReturnType<typeof prepareStudioPlan>>[] = []
        for (const rate of rates) {
          await measureLatencies(
            [resolveStudioSoundGraph(project, masterGain ?? undefined).full],
            rate,
          )
          plans.push(
            await prepareStudioPlan(
              project,
              assets,
              rate,
              0,
              signal,
              measureLatencies,
            ),
          )
        }
        const plan = plans.at(-1)
        if (plan === undefined || busy()) return
        const lease = await cache.acquire(
          planAssets(plan, assets),
          factory,
          options.readCanonicalAsset,
          signal,
        )
        lease.release()
      } catch {
        // Play repeats this work and reports its own failure.
      }
    })
    warming = run
    return run
  }

  return {
    play,
    warm,
    setRepeat(enabled: boolean) {
      repeat = enabled
    },
    setMasterGain(value: StudioMasterGainToken | null) {
      if (
        value &&
        (!Number.isFinite(value.gainDb) ||
          value.gainDb < -24 ||
          value.gainDb > 36 ||
          !Number.isFinite(value.safetyGainDb) ||
          value.safetyGainDb > 0 ||
          value.safetyGainDb < -24)
      )
        throw new Error('The prepared master has invalid gain settings.')
      masterGain = value === null ? null : { ...value }
      publish({ masterReady: masterGain !== null })
    },
    resetPeakHold() {
      active?.meter?.clearPeakHold()
    },
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
      observeSnapshot(project)
      if (!wantsPlayback || disposed) return
      const token = ++restartGeneration
      const frame = active ? position(active) : state.playheadFrame
      pause(true)
      // The old run fades out on its own while the new one prepares.
      await preparationDone
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
      await preparationDone
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
