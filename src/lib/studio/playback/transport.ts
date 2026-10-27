// Studio transport — one borrowed clock, explicit playback intent and generation-owned graph cleanup.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import { closeEnvelope } from '@/lib/preview-player'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import { estimateTailSeconds } from '@/lib/studio-fx/render'
import type { StudioMasterGain, StudioMasterGainToken, } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { reserveStudioMemory } from '../memory-budget'
import { createStudioLiveMeter, prepareStudioLiveMeter, } from '../metering/live-meter'
import type { StudioMeterSnapshot } from '../metering/stream-meter'
import { compileStudioArrangement, studioLaneSpec, } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject, StudioTrack } from '../model/types'
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
/** A lane's volume or pan while its control is still moving. */
export type StudioLaneDraft = Partial<Pick<StudioTrack, 'gainDb' | 'pan'>>

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
  project: StudioProject
  /** Tracks with material from where this run started. */
  sounding: ReadonlySet<string>
  envelope: GainNode
  /** The measured master gains it was built with; sound edits keep them. */
  measured: StudioMasterGain
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
  let warmAbort: AbortController | null = null
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
  // Controls still moving: heard at once, saved only when the gesture ends.
  const laneDrafts = new Map<string, StudioLaneDraft>()
  const macroDrafts = new Map<MacroKey, number>()
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

  /** The project as it sounds now: saved values under the controls still moving. */
  function withDrafts(project: StudioProject): StudioProject {
    if (!laneDrafts.size && !macroDrafts.size) return project
    return {
      ...project,
      mix: {
        ...project.mix,
        macros: { ...project.mix.macros, ...Object.fromEntries(macroDrafts) },
      },
      tracks: project.tracks.map((track) => {
        const draft = laneDrafts.get(track.id)
        return draft ? { ...track, ...draft } : track
      }),
    }
  }

  function applyMix(run: Run, project: StudioProject): void {
    const audible = audibility(project)
    for (const track of project.tracks)
      run.graph.setLaneMix(track, audible(track))
  }

  /** Move the running chains to the project's sound; their tails set the end. */
  function applySound(run: Run, project: StudioProject): void {
    let tail = 0
    for (const track of project.tracks) {
      if (!run.graph.hasLane(track.id)) continue
      const spec = studioLaneSpec(track, project.mix.macros)
      run.graph.setLaneSpec(track.id, spec)
      tail = Math.max(tail, estimateTailSeconds(spec))
    }
    run.graph.setMasterSpec(resolveStudioSoundGraph(project, run.measured).full)
    if (!run.repeat)
      run.endsAt =
        run.audibleEpoch +
        (run.endFrame - run.startFrame + Math.ceil(tail * 48000)) / 48000
  }

  /** A control moved while the song was getting ready: start as it sounds. */
  function applyDrafts(run: Run): void {
    if (!laneDrafts.size && !macroDrafts.size) return
    const live = withDrafts(run.project)
    applyMix(run, live)
    applySound(run, live)
  }

  /**
   * Apply an edit to the running graph, so the song keeps playing. Lane
   * volume, balance, pan, Mute and Solo glide; the macros, a flavour's master
   * EQ and the ceiling move the running chains, which send only the values
   * that changed. An edit to nothing the graph plays, such as an empty new
   * lane or a name, changes nothing. False when it needs a restart: other
   * clips or chain shapes, or a lane with material that was silent when Play
   * built the graph.
   */
  function playInPlace(run: Run, project: StudioProject): boolean {
    if (graphShape(run.project) !== graphShape(project)) return false
    const live = withDrafts(project)
    const audible = audibility(live)
    const missing = live.tracks.some(
      (track) =>
        audible(track) &&
        run.sounding.has(track.id) &&
        !run.graph.hasLane(track.id),
    )
    if (missing) return false
    applyMix(run, live)
    if (macroDrafts.size || soundKey(run.project) !== soundKey(project))
      applySound(run, live)
    run.project = project
    return true
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

  /** A build that missed its start still teaches the next warmup. */
  function learnWarmup(built: number | null): void {
    if (built !== null) buildSeconds = (performance.now() - built) / 1000
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
    let built: number | null = null
    try {
      // Called immediately by an explicit UI action, before asset reads.
      const ctx = await unlockContext(attempt.signal)
      observeSnapshot(project)
      const { content, from } = playableContent(project, assets, startFrame)
      const measured: StudioMasterGain = {
        gainDb: masterGain?.gainDb ?? 0,
        safetyGainDb: masterGain?.safetyGainDb ?? 0,
      }
      const sound = resolveStudioSoundGraph(project, measured)
      releaseMemory = await reserveGraph(
        studioGraphWorkingBytes(content, ctx.sampleRate, sound.full),
        attempt.signal,
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
      built = performance.now()
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
      active = {
        ctx,
        graph,
        project,
        sounding: new Set(
          plan.lanes
            .filter((lane) => lane.segments.length > 0)
            .map((lane) => lane.track.id),
        ),
        envelope,
        measured,
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
      applyDrafts(active)
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
      learnWarmup(built)
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

  /**
   * A seek or edit starts the next run while the last one fades for 240 ms.
   * When both graphs do not fit, wait for the fade instead of failing.
   */
  async function reserveGraph(
    bytes: number,
    signal: AbortSignal,
  ): Promise<() => void> {
    try {
      return reserveStudioMemory(bytes)
    } catch (error) {
      if (!retired.size) throw error
      await new Promise<void>((resolve) => releasedListeners.add(resolve))
      signal.throwIfAborted()
      return reserveStudioMemory(bytes)
    }
  }

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
    const abort = new AbortController()
    warmAbort = abort
    const run = warming.then(async () => {
      if (busy() || abort.signal.aborted) return
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
      const signal = abort.signal
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
        if (plan === undefined || busy() || signal.aborted) return
        const lease = await cache.acquire(
          planAssets(plan, assets),
          factory,
          options.readCanonicalAsset,
          signal,
        )
        lease.release()
      } catch {
        // Play repeats this work and reports its own failure.
      } finally {
        if (warmAbort === abort) warmAbort = null
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
    /**
     * Hear a lane's volume or pan while its control moves, without saving.
     * Null ends the preview and returns the lane to its saved values, so call
     * it after the gesture's own commit.
     */
    previewLane(trackId: string, draft: StudioLaneDraft | null): void {
      if (draft === null) laneDrafts.delete(trackId)
      else laneDrafts.set(trackId, { ...draft })
      const run = active
      if (!run) return
      const live = withDrafts(run.project)
      const track = live.tracks.find((item) => item.id === trackId)
      if (track) run.graph.setLaneMix(track, audibility(live)(track))
    },
    /** The same for a sound macro: the running chains follow a moving dial. */
    previewMacro(name: MacroKey, value: number | null): void {
      if (value === null) macroDrafts.delete(name)
      else macroDrafts.set(name, value)
      if (active) applySound(active, withDrafts(active.project))
    },
    pause: () => pause(),
    stop() {
      pause()
      laneDrafts.clear()
      macroDrafts.clear()
      publish({ playheadFrame: 0, error: null })
      cache.clear()
    },
    async releaseAudio(): Promise<void> {
      pause()
      // Export, Compare and auto-balance need the room a warm-up holds.
      warmAbort?.abort()
      await warming
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
      if (active && !preparing && playInPlace(active, project)) return
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
      warmAbort?.abort()
      clearInterval(timer)
      watchedContext?.removeEventListener('statechange', onClockState)
      watchedContext = null
      cache.dispose()
    },
  }
}

export type StudioTransport = ReturnType<typeof createStudioTransport>

function audibility(project: StudioProject): (track: StudioTrack) => boolean {
  const hasSolo = project.tracks.some((track) => track.solo)
  return (track) => !track.mute && (!hasSolo || track.solo)
}

/**
 * What a running graph is built from: the clips, and the effect list of each
 * lane that has any. Two projects with the same shape play through the same
 * graph; mix and sound settings move it in place.
 */
function graphShape(project: StudioProject): string {
  const used = new Set(project.clips.map((clip) => clip.trackId))
  const byId = <T extends { id: string }>(a: T, b: T) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return JSON.stringify({
    clips: [...project.clips].sort(byId),
    lanes: project.tracks
      .filter((track) => used.has(track.id))
      .sort(byId)
      .map((track) => [
        track.id,
        track.fx.baseSpec.effects.map(
          (effect) => `${effect.id}:${effect.kind}`,
        ),
      ]),
  })
}

/** Everything the running chains play with. */
function soundKey(project: StudioProject): string {
  return JSON.stringify([
    project.mix.macros,
    project.master.masterEq,
    project.master.ceilingDbtp,
    project.tracks.map((track) => [track.id, track.fx]),
  ])
}
