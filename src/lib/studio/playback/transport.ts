// Studio transport — one borrowed clock, explicit playback intent and generation-owned graph cleanup.
//
// An edit the running graph cannot follow builds a new run while the old one
// keeps playing ("held"), then hands over on the same frame with a short
// crossfade (handoff.ts), so the song never stops for an edit. A newer edit
// replaces a run that is not heard yet, so a burst of edits builds one run at
// a time. Only when memory cannot hold both graphs does the song fade out and
// restart where it was.
import type { AudioContextLease } from '@/lib/audio-context-lease'
import { closeEnvelope } from '@/lib/preview-player'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import type { StudioMasterGain, StudioMasterGainToken, } from '../export/sound-graph'
import { resolveStudioSoundGraph } from '../export/sound-graph'
import { reserveStudioMemory } from '../memory-budget'
import { createStudioLaneMeter, prepareStudioLiveMeter, } from '../metering/live-meter'
import type { StudioMeterSnapshot } from '../metering/stream-meter'
import type { StudioArrangementPlan } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import type { StudioBufferCache } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import { buildStudioGraph, studioGraphWorkingBytes } from './graph'
import { cancelHandoff, handoffTiming, scheduleHandoff } from './handoff'
import type { StudioDrafts, StudioLaneDraft } from './in-place'
import { applyDrafts, applyMix, applySound, followMaster, followRepeat, playInPlace, withDrafts, } from './in-place'
import type { StudioRunLayout } from './live-edit'
import { audibility, firstThatFits, studioRunLayouts } from './live-edit'
import type { StudioLatencyReader } from './prepare-plan'
import { createLatencyCache, planAssets, planLatencySeconds, prepareStudioPlan, } from './prepare-plan'
import type { StudioLaneLevel, StudioRun, StudioRunParts, StudioRunTiming, } from './run'
import { buildStudioRun, openRunEnvelope, readLaneLevels, releaseRun, RUN_LOOKAHEAD_SECONDS, runEndsAt, runPosition, } from './run'
import { warmStudioPlayback } from './warm-up'

export type { StudioLaneDraft } from './in-place'
export type { StudioLaneLevel } from './run'

const RELEASE_MS = 240
// A handed-over run is silent once its crossfade ends; free it a little later.
const HANDOFF_RELEASE_SLACK_MS = 60
// A handover this close is left to happen: taking it back could catch its crossfade begun.
const CANCEL_MARGIN_SECONDS = 0.05
// Lead time between building the graph and its first sound. It follows how
// long the last build took, so a fast machine starts in about a tenth of a
// second and a slow one still schedules ahead of its clock.
const MIN_WARMUP_SECONDS = 0.1
const MAX_WARMUP_SECONDS = 0.5

export interface StudioTransportState {
  playing: boolean
  pending: boolean
  playheadFrame: number
  peakL: number
  peakR: number
  error: string | null
  meter: StudioMeterSnapshot | null
  masterReady: boolean
  /** Every built lane's level while the song plays; empty when it does not. */
  lanes: readonly StudioLaneLevel[]
}

export interface StudioTransportOptions {
  lease: AudioContextLease
  readCanonicalAsset(id: string): Promise<Blob>
  changed(state: StudioTransportState): void
  cache?: StudioBufferCache
  measureLatencies?: StudioLatencyReader
  buildGraph?: typeof buildStudioGraph
  createLaneMeter?: typeof createStudioLaneMeter
}

/** A run taking over: `from` is heard until `at`, then crossfades to `to`. */
interface Handoff {
  readonly from: StudioRun
  readonly to: StudioRun
  readonly at: number
}

export function createStudioTransport(options: StudioTransportOptions) {
  const cache = options.cache ?? createStudioBufferCache()
  const measureLatencies = createLatencyCache(
    options.measureLatencies ?? measureTrackLatencies,
  )
  const buildGraph = options.buildGraph ?? buildStudioGraph
  const createLaneMeter = options.createLaneMeter ?? createStudioLaneMeter
  let buildSeconds = 0.1
  let warming: Promise<void> = Promise.resolve()
  let warmAbort: AbortController | null = null
  const retired = new Set<StudioRun>()
  const retiredTimers = new Map<StudioRun, ReturnType<typeof setTimeout>>()
  // The newest run: heard, or about to be once its handover begins.
  let active: StudioRun | null = null
  // The run heard while the next one is built to take over from it.
  let held: StudioRun | null = null
  // Handovers not over yet, oldest first.
  const handoffs: Handoff[] = []
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
  const drafts: StudioDrafts = { lanes: new Map(), macros: new Map() }
  let state: StudioTransportState = {
    playing: false,
    pending: false,
    playheadFrame: 0,
    peakL: 0,
    peakR: 0,
    error: null,
    meter: null,
    masterReady: false,
    lanes: [],
  }
  let watchedContext: AudioContext | null = null
  const publish = (update: Partial<StudioTransportState>) => {
    state = { ...state, ...update }
    if (!disposed) options.changed(state)
  }

  /** Every run heard or about to be: fading out in a handover, held, newest. */
  function liveRuns(): StudioRun[] {
    const runs = handoffs.map(({ from }) => from)
    if (held) runs.push(held)
    if (active) runs.push(active)
    return runs
  }

  /** The run heard now: the newest one whose handover has begun. */
  function heard(): StudioRun | null {
    const run = active ?? held
    if (!run) return null
    const now = run.ctx.currentTime
    return handoffs.find(({ at }) => now < at)?.from ?? run
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

  function release(run: StudioRun): void {
    releaseRun(run)
    retired.delete(run)
    retiredTimers.delete(run)
    const index = handoffs.findIndex(({ from }) => from === run)
    if (index >= 0) handoffs.splice(index, 1)
    if (disposed) cache.dispose()
    if (!retired.size) {
      for (const settled of releasedListeners) settled()
      releasedListeners.clear()
    }
  }

  /** Fade a run out now and free it once silent; one already fading fades now instead. */
  function retire(run: StudioRun): void {
    clearTimeout(retiredTimers.get(run))
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

  /** Fade out every run heard or about to be. The playhead stays where it was heard. */
  function silence(): Partial<StudioTransportState> {
    const shown = heard()
    const stopped = { peakL: 0, peakR: 0, meter: null, lanes: [] }
    const update = shown
      ? { ...stopped, playheadFrame: runPosition(shown) }
      : stopped
    for (const run of liveRuns()) retire(run)
    active = null
    held = null
    handoffs.length = 0
    return update
  }

  function pause(preserveIntent = false): void {
    if (!preserveIntent) {
      wantsPlayback = false
      restartGeneration++
    }
    generation++
    abort?.abort()
    publish({ ...silence(), playing: false, pending: preparing })
  }

  function onClockState(): void {
    if (watchedContext?.state !== 'running' && (active || held || preparing)) {
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

  /** Where a run from `frame` starts: at the top once the song has ended there. */
  function firstFrame(endFrame: number, frame: number): number {
    return frame >= endFrame ? 0 : Math.max(0, Math.floor(frame))
  }

  function playableContent(
    project: StudioProject,
    assets: readonly StudioAsset[],
    startFrame: number,
  ) {
    const content = compileStudioArrangement(project, assets)
    if (!content.lanes.some((lane) => lane.audible && lane.segments.length > 0))
      throw new Error('Add an audible take before playing.')
    if (repeat && content.endFrame < 12000)
      throw new Error('A song needs at least a quarter second to repeat.')
    return { content, from: firstFrame(content.endFrame, startFrame) }
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

  /**
   * When the new run is heard and from which frame: in step with the held
   * run, or, starting from silence, as soon as it can be built from
   * `restartFrom`. Null when the held run plays its last pass out before it
   * could take over, so the song ends there.
   */
  function runTiming(
    ctx: AudioContext,
    plan: StudioArrangementPlan,
    latency: number,
    restartFrom: number,
  ): StudioRunTiming | null {
    const warmup = Math.min(
      MAX_WARMUP_SECONDS,
      Math.max(MIN_WARMUP_SECONDS, buildSeconds * 2 + 0.04),
    )
    const earliest = ctx.currentTime + warmup + latency
    if (held) {
      const timing = handoffTiming(held, earliest, plan.endFrame)
      if (timing || !repeat) return timing
      // Repeat came on after the held run's loop point: start again from the top.
      retire(held)
      held = null
      return { fromFrame: 0, audibleEpoch: earliest }
    }
    return {
      fromFrame: firstFrame(plan.endFrame, restartFrom),
      audibleEpoch: earliest,
    }
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
    return start(project, assets, startFrame)
  }

  /** A preparation begins: Play and edits wait for it to settle. */
  function begin(): AbortController {
    const attempt = new AbortController()
    abort = attempt
    preparing = true
    preparationDone = new Promise<void>((resolve) => {
      preparationSettled = resolve
    })
    // A held run plays on, so the song is not waiting for anything.
    publish(held ? { error: null } : { pending: true, error: null })
    return attempt
  }

  function settle(attempt: AbortController): void {
    preparing = false
    if (!active && !held) publish({ pending: false })
    preparationSettled?.()
    preparationSettled = null
    if (abort === attempt) abort = null
  }

  /** Build and start a run: from `startFrame`, or taking over from the held run. */
  async function start(
    project: StudioProject,
    assets: readonly StudioAsset[],
    startFrame: number,
  ): Promise<boolean> {
    const token = ++generation
    const attempt = begin()
    const handingOver = held !== null
    let admitted: Awaited<ReturnType<typeof admit>> | undefined
    let built: number | null = null
    try {
      // Called immediately by an explicit UI action, before asset reads.
      const ctx = await unlockContext(attempt.signal)
      observeSnapshot(project)
      const { from } = playableContent(project, assets, startFrame)
      const measured: StudioMasterGain = {
        gainDb: masterGain?.gainDb ?? 0,
        safetyGainDb: masterGain?.safetyGainDb ?? 0,
      }
      const sound = resolveStudioSoundGraph(project, measured)
      // A background warm-up does the same reads; wait for it, not around it.
      await warming
      attempt.signal.throwIfAborted()
      const masterLatency = await prepareMaster(ctx, sound.full, attempt.signal)
      admitted = await firstThatFits(studioRunLayouts(from, repeat), (layout) =>
        admit(project, assets, ctx, sound.full, layout, attempt.signal),
      )
      attempt.signal.throwIfAborted()
      if (token !== generation || disposed)
        throw new DOMException('Playback cancelled', 'AbortError')
      built = performance.now()
      const latency = planLatencySeconds(admitted.plan) + masterLatency
      // A held run dropped for memory leaves the playhead where it stopped.
      const timing = runTiming(
        ctx,
        admitted.plan,
        latency,
        handingOver ? state.playheadFrame : from,
      )
      if (!timing) return playOut()
      launch({
        ...admitted,
        ctx,
        project,
        master: sound.full,
        measured,
        timing,
        latency,
      })
      admitted = undefined
      return true
    } catch (error) {
      if (token === generation && !disposed && !attempt.signal.aborted)
        failed(error)
      return false
    } finally {
      learnWarmup(built)
      admitted?.buffers.release()
      admitted?.releaseMemory()
      settle(attempt)
    }
  }

  /** Start a built run: the held run hands over to it, or it opens from silence. */
  function launch(
    parts: Omit<
      StudioRunParts,
      'repeat' | 'buildGraph' | 'createLaneMeter' | 'open'
    >,
  ): void {
    const outgoing = held
    const run = buildStudioRun({
      ...parts,
      repeat,
      buildGraph,
      createLaneMeter,
      open: outgoing
        ? (envelope, time) => scheduleHandoff(outgoing.envelope, envelope, time)
        : openRunEnvelope,
    })
    active = run
    if (outgoing) handOver(outgoing, run, parts.timing.audibleEpoch)
    applyDrafts(run, drafts)
    const { fromFrame } = parts.timing
    publish(
      outgoing
        ? { playing: true }
        : { playing: true, pending: false, playheadFrame: fromFrame },
    )
  }

  /** The held run reaches its end before a new run could take over: it plays out. */
  function playOut(): boolean {
    active = held
    held = null
    return true
  }

  function failed(error: unknown): void {
    wantsPlayback = false
    // A held run cannot hand over to a run that failed: it stops too.
    publish({
      ...silence(),
      pending: false,
      playing: false,
      error:
        error instanceof Error
          ? error.message
          : 'Studio could not play this project.',
    })
  }

  /** `from` is heard until `at`, then fades as `to` comes in; it is freed once silent. */
  function handOver(from: StudioRun, to: StudioRun, at: number): void {
    held = null
    handoffs.push({ from, to, at })
    retired.add(from)
    releaseWhenSilent(from, to.openAt)
  }

  /** Free a handed-over run after its crossfade, by the audio clock, which can fall behind. */
  function releaseWhenSilent(run: StudioRun, silentAt: number): void {
    const wait = Math.max(0, silentAt - run.ctx.currentTime) * 1000
    retiredTimers.set(
      run,
      setTimeout(() => {
        if (run.ctx.state === 'running' && run.ctx.currentTime < silentAt)
          releaseWhenSilent(run, silentAt)
        else release(run)
      }, wait + HANDOFF_RELEASE_SLACK_MS),
    )
  }

  /**
   * Take back a handover that has not begun: its `from` plays on at full
   * level, and its `to`, never heard, is freed at once. False when it
   * begins too soon to take back.
   */
  function cancelHandover(handoff: Handoff): boolean {
    const { from, to, at } = handoff
    if (at - to.ctx.currentTime < CANCEL_MARGIN_SECONDS) return false
    cancelHandoff(from.envelope, at)
    from.openAt = Math.max(from.openAt, at)
    clearTimeout(retiredTimers.get(from))
    retiredTimers.delete(from)
    retired.delete(from)
    handoffs.splice(handoffs.indexOf(handoff), 1)
    release(to)
    return true
  }

  /**
   * Hold the run heard while the next one is built for `project`. A newer
   * edit replaces the run built for an older one, until that run is heard,
   * so a burst of edits never stacks runs. Without a run to hold, the song
   * stops and restarts. Returns where a restart starts.
   */
  function hold(project: StudioProject): number {
    if (active && !preparing) {
      const pending = handoffs.find(({ to }) => to === active)
      held = pending && cancelHandover(pending) ? pending.from : active
      active = null
    } else if (held) {
      generation++
      abort?.abort()
    } else {
      const shown = heard()
      const frame = shown ? runPosition(shown) : state.playheadFrame
      pause(true)
      return frame
    }
    // Mute, Solo and the faders reach the held run at once.
    applyMix(held, withDrafts(project, drafts))
    return runPosition(heard() ?? held)
  }

  const timer = setInterval(() => {
    const run = active ?? held
    if (!run) return
    try {
      const ahead = run.ctx.currentTime + RUN_LOOKAHEAD_SECONDS
      for (const live of liveRuns()) live.graph.scheduleUntil(ahead)
      const shown = heard() ?? run
      const meter = shown.meter?.read() ?? null
      const [peakL, peakR] = meter
        ? [meter.peakL, meter.peakR]
        : shown.graph.readPeaks()
      publish({
        playheadFrame: runPosition(shown),
        peakL,
        peakR,
        meter,
        // A tick with nothing new, or a run just taken over, keeps the last.
        lanes: readLaneLevels(shown) ?? state.lanes,
      })
      if (run.ctx.currentTime >= runEndsAt(run)) pause()
    } catch (error) {
      pause()
      publish({
        error: error instanceof Error ? error.message : 'Playback stopped.',
      })
    }
  }, 33)

  /**
   * A seek or edit starts the next run while the last one still plays or
   * fades. When both graphs do not fit, a held run stops, so the song fades
   * out and restarts where it was, and the new run waits for the fade:
   * waiting while it still played would wait forever.
   */
  async function reserveGraph(
    bytes: number,
    signal: AbortSignal,
  ): Promise<() => void> {
    try {
      return reserveStudioMemory(bytes)
    } catch (error) {
      if (held) publish({ ...silence(), playing: false, pending: true })
      if (!retired.size) throw error
      await new Promise<void>((resolve) => releasedListeners.add(resolve))
      signal.throwIfAborted()
      return reserveStudioMemory(bytes)
    }
  }

  /** The plan, graph memory and audio for a run built as `layout` says. */
  async function admit(
    project: StudioProject,
    assets: readonly StudioAsset[],
    ctx: AudioContext,
    master: ChainSpec,
    { silentLanes, start: planStart }: StudioRunLayout,
    signal: AbortSignal,
  ) {
    const plan = await prepareStudioPlan(
      project,
      assets,
      ctx.sampleRate,
      planStart,
      signal,
      measureLatencies,
      silentLanes,
    )
    const releaseMemory = await reserveGraph(
      studioGraphWorkingBytes(plan, ctx.sampleRate, master, silentLanes),
      signal,
    )
    try {
      const buffers = await cache.acquire(
        planAssets(plan, assets, silentLanes),
        ctx,
        options.readCanonicalAsset,
        signal,
      )
      return { plan, silentLanes, buffers, releaseMemory }
    } catch (error) {
      releaseMemory()
      throw error
    }
  }

  async function waitForRelease(): Promise<void> {
    await preparationDone
    if (retired.size)
      await new Promise<void>((resolve) => releasedListeners.add(resolve))
  }

  /**
   * Read the song's audio and measure its chains before anyone presses Play,
   * so the press only builds the graph.
   */
  function warm(
    project: StudioProject,
    assets: readonly StudioAsset[],
  ): Promise<void> {
    // A function, so each check reads the state after the awaits before it.
    const busy = () => disposed || preparing || active !== null || held !== null
    if (busy()) return warming
    const abort = new AbortController()
    warmAbort = abort
    const run = warming.then(async () => {
      if (busy() || abort.signal.aborted) return
      try {
        playableContent(project, assets, 0)
        await warmStudioPlayback(project, assets, abort.signal, {
          lease: options.lease,
          cache,
          measureLatencies,
          readCanonicalAsset: options.readCanonicalAsset,
          masterGain: masterGain ?? undefined,
          busy,
        })
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
    /**
     * A running song follows at once. When the loop point has already gone
     * by, the setSnapshot that follows starts it again from the top.
     */
    setRepeat(enabled: boolean) {
      repeat = enabled
      for (const run of [active, held]) if (run) followRepeat(run, enabled)
    },
    /** A playing song glides to a newly measured master gain. */
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
      for (const run of liveRuns())
        if (followMaster(run, masterGain))
          applySound(run, withDrafts(run.project, drafts))
    },
    resetPeakHold() {
      heard()?.meter?.clearPeakHold()
    },
    /**
     * Hear a lane's volume or pan while its control moves, without saving.
     * Null ends the preview and returns the lane to its saved values, so call
     * it after the gesture's own commit.
     */
    previewLane(trackId: string, draft: StudioLaneDraft | null): void {
      if (draft === null) drafts.lanes.delete(trackId)
      else drafts.lanes.set(trackId, { ...draft })
      for (const run of liveRuns()) {
        const live = withDrafts(run.project, drafts)
        const track = live.tracks.find((item) => item.id === trackId)
        if (track) run.graph.setLaneMix(track, audibility(live)(track))
      }
    },
    /** The same for a sound macro: the running chains follow a moving dial. */
    previewMacro(name: MacroKey, value: number | null): void {
      if (value === null) drafts.macros.delete(name)
      else drafts.macros.set(name, value)
      for (const run of liveRuns())
        applySound(run, withDrafts(run.project, drafts))
    },
    pause: () => pause(),
    stop() {
      pause()
      drafts.lanes.clear()
      drafts.macros.clear()
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
      if (
        active &&
        !preparing &&
        playInPlace(active, project, { drafts, repeat, masterGain })
      ) {
        // A run heard until its handover follows the mix too.
        for (const { from } of handoffs)
          applyMix(from, withDrafts(project, drafts))
        return
      }
      const token = ++restartGeneration
      const frame = hold(project)
      // A held run plays on, and a faded one fades on its own, while the
      // last preparation settles.
      await preparationDone
      if (wantsPlayback && !disposed && token === restartGeneration)
        await start(project, assets, frame)
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
