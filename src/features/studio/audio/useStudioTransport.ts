// Studio transport hook — explicit playback and preview through the active host's borrowed clock.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { PreviewPlayer } from '@/lib/preview-player'
import { createPreviewPlayer } from '@/lib/preview-player'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import type { StudioMasterGainToken } from '@/lib/studio/export/sound-graph'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioLaneDraft, StudioTransportState, } from '@/lib/studio/playback/transport'
import { createStudioTransport } from '@/lib/studio/playback/transport'
import type { MacroKey } from '@/lib/studio-fx/mix-macros'
import { initAudioEngine } from '@/stores/app-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { createStudioReadoutFrame } from './readout-frame'
import { createStudioWebLease } from './web-audio-lease'

export interface UseStudioTransportOptions {
  project: Accessor<StudioProject | null>
  assets: Accessor<readonly StudioAsset[]>
  readCanonicalAsset(assetId: string): Promise<Blob>
  audioLease?: AudioContextLease
  beforePlay?: () => void
}

export interface StudioPreviewOptions {
  gainDb?: number
  startSeconds?: number
  /** Exact rendered-WAV duration for prepared comparisons; source previews default to five minutes. */
  durationSeconds?: number
}

function previewSettings(options: StudioPreviewOptions) {
  const gainDb = options.gainDb ?? 0
  const durationSeconds =
    options.durationSeconds ?? DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames / 48000
  const startSeconds = options.startSeconds ?? 0
  if (
    !Number.isFinite(gainDb) ||
    gainDb > 0 ||
    gainDb < -120 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 3600 ||
    !Number.isFinite(startSeconds) ||
    startSeconds < 0 ||
    startSeconds > durationSeconds
  )
    throw new Error('This preview has invalid timing or level settings.')
  return { gainDb, durationSeconds, startSeconds }
}

export function useStudioTransport(options: UseStudioTransportOptions) {
  let disposed = false
  let prepareToSuspend = () => 0
  const native = options.audioLease ? null : untrack(nativeDeviceApi)
  const nativeLease = native?.acquireAudio('studio', {
    prepareToSuspend: () => prepareToSuspend(),
  })
  const [hostReady, setHostReady] = createSignal(
    !!(options.audioLease ?? nativeLease),
  )
  const lease: AudioContextLease =
    options.audioLease ??
    nativeLease ??
    createStudioWebLease(initAudioEngine(), (ready) => {
      if (!disposed) setHostReady(ready)
    })
  const [state, setState] = createSignal<StudioTransportState>({
    playing: false,
    pending: false,
    playheadFrame: 0,
    peakL: 0,
    peakR: 0,
    error: null,
    meter: null,
    masterReady: false,
    lanes: [],
  })
  // A tick brings new levels and a new position. Whether the song plays, an
  // error and the master change only with playback, so what shows them does
  // not rerun on a tick.
  const isPlaying = createMemo(() => state().playing)
  const statePending = createMemo(() => state().pending)
  const stateError = createMemo(() => state().error)
  const masterReady = createMemo(() => state().masterReady)
  const meterReady = createMemo(() => state().meter !== null)
  const laneLevels = createMemo(
    () => new Map(state().lanes.map((lane) => [lane.trackId, lane] as const)),
  )
  // The readouts follow a playing song ten times a second; the playhead
  // line follows the clock every display frame on its own: ticks(), frameNow().
  const readout = createStudioReadoutFrame(STUDIO_SAMPLE_RATE)
  const ticks = new Set<() => void>()
  const [repeating, setRepeating] = createSignal(false)
  const [previewPending, setPreviewPending] = createSignal(false)
  const [previewError, setPreviewError] = createSignal<string | null>(null)
  const [previewing, setPreviewing] = createSignal(false)
  const runtime = createStudioTransport({
    lease,
    readCanonicalAsset: options.readCanonicalAsset,
    changed: (value) => {
      if (disposed) return
      batch(() => {
        setState(value)
        readout.follow(value)
      })
      for (const tick of ticks) tick()
    },
  })
  let preview: {
    player: PreviewPlayer
    url: string
    release: () => void
  } | null = null
  let previewGeneration = 0
  let primedPreview: Promise<boolean> | null = null
  const retiringPreviews = new Set<Promise<void>>()

  function stopPreview(): void {
    previewGeneration++
    primedPreview = null
    if (!disposed) {
      setPreviewPending(false)
      setPreviewing(false)
    }
    const current = preview
    preview = null
    if (!current) return
    current.player.stop()
    const retired = new Promise<void>((resolve) =>
      setTimeout(() => {
        current.player.dispose()
        URL.revokeObjectURL(current.url)
        current.release()
        resolve()
      }, 240),
    )
    retiringPreviews.add(retired)
    void retired.finally(() => retiringPreviews.delete(retired))
  }

  async function releaseAudio(): Promise<void> {
    stopPreview()
    await Promise.all([runtime.releaseAudio(), ...retiringPreviews])
  }

  function primeAudio(): Promise<boolean> {
    stopPreview()
    runtime.pause()
    primedPreview = lease.unlock().catch(() => false)
    return primedPreview
  }

  async function play(): Promise<boolean> {
    const project = options.project()
    const assets = options.assets()
    if (!project || disposed) return false
    options.beforePlay?.()
    stopPreview()
    setPreviewError(null)
    return runtime.play(project, assets)
  }

  function previewContext(blob: Blob, prepared = false): AudioContext {
    const ctx = lease.ensure()
    if (!ctx || ctx.state !== 'running')
      throw new Error('The audio device is not ready.')
    if (!blob.size || (!prepared && blob.size > 64 * 1024 * 1024))
      throw new Error('This take is too large to preview here.')
    return ctx
  }

  function previewFailure(
    played: boolean,
    player: PreviewPlayer,
    durationSeconds: number,
  ): string | null {
    if (!played) return 'This take could not be previewed.'
    if (player.duration > durationSeconds + 0.1)
      return 'This audio is longer than its preview allowance.'
    return null
  }

  async function previewSource(
    blob: Blob,
    settings: StudioPreviewOptions = {},
  ): Promise<boolean> {
    if (disposed) return false
    // The picker primes before its original-byte read. A direct Blob preview
    // can still activate synchronously when invoked by its own click.
    const unlocked = primedPreview ?? lease.unlock().catch(() => false)
    stopPreview()
    const token = ++previewGeneration
    setPreviewPending(true)
    setPreviewError(null)
    let release: (() => void) | undefined
    let url: string | undefined
    let player: PreviewPlayer | undefined
    try {
      const resolved = previewSettings(settings)
      // Unlock now; waiting for the song's release must not lose the gesture.
      await runtime.releaseAudio()
      await Promise.all(retiringPreviews)
      if (!(await unlocked))
        throw new Error('Audio could not start. Try Preview again.')
      if (disposed || token !== previewGeneration) return false
      const ctx = previewContext(blob, settings.durationSeconds !== undefined)
      // Media decoding is browser-managed. Reserve the supported five-minute
      // stereo working allowance as well as encoded bytes, not just file size.
      release = reserveStudioMemory(
        blob.size * 2 + Math.ceil(resolved.durationSeconds * 48000) * 2 * 4 * 2,
      )
      url = URL.createObjectURL(blob)
      player = createPreviewPlayer({
        audioGraph: { context: ctx, destination: ctx.destination },
        onEnded: stopPreview,
        createProcessing(context) {
          const gain = context.createGain()
          gain.gain.value = Math.pow(10, resolved.gainDb / 20)
          return { input: gain, output: gain, dispose: () => gain.disconnect() }
        },
      })
      preview = { player, url, release }
      player = undefined
      url = undefined
      release = undefined
      const played = await preview.player.play(preview.url, {
        startSeconds: resolved.startSeconds,
      })
      if (disposed || token !== previewGeneration) return false
      const failure = previewFailure(
        played,
        preview.player,
        resolved.durationSeconds,
      )
      if (failure !== null) {
        setPreviewError(failure)
        stopPreview()
        return false
      }
      setPreviewing(true)
      return true
    } catch (error) {
      if (!disposed && token === previewGeneration)
        setPreviewError(
          error instanceof Error ? error.message : 'Preview could not start.',
        )
      return false
    } finally {
      player?.dispose()
      if (url !== undefined) URL.revokeObjectURL(url)
      release?.()
      if (!disposed && token === previewGeneration) setPreviewPending(false)
    }
  }

  prepareToSuspend = () => {
    stopPreview()
    return Math.max(runtime.prepareToSuspend(), retiringPreviews.size ? 240 : 0)
  }
  let observedId: string | null = null
  let observedRevision = -1
  createEffect(() => {
    const project = options.project()
    const assets = options.assets()
    if (project?.id !== observedId) {
      runtime.setMasterGain(null)
      runtime.stop()
      stopPreview()
      observedId = project?.id ?? null
    } else if (project !== null && project.revision !== observedRevision) {
      void runtime.setSnapshot(project, assets).catch((error: unknown) => {
        if (!disposed)
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Playback could not follow this edit.',
          )
      })
    }
    observedRevision = project?.revision ?? -1
  })

  // Warm the playback cache once edits settle, so Play starts without reading.
  let warmTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const project = options.project()
    const assets = options.assets()
    clearTimeout(warmTimer)
    if (!hostReady() || !project || project.clips.length === 0 || isPlaying())
      return
    warmTimer = setTimeout(() => {
      if (!disposed) void runtime.warm(project, assets)
    }, 400)
  })
  onCleanup(() => clearTimeout(warmTimer))

  function onVisibility(): void {
    // A graph Pause kept is let go sooner while nobody can press Play.
    runtime.setPageHidden(document.hidden)
    if (document.hidden) {
      runtime.pause()
      stopPreview()
    }
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibility)

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisibility)
    void releaseAudio().finally(() => {
      runtime.dispose()
      nativeLease?.release()
    })
  }
  onCleanup(dispose)
  const ready = createMemo(
    () => hostReady() && (options.project()?.clips.length ?? 0) > 0,
  )
  return {
    ready,
    repeating,
    async setRepeat(enabled: boolean): Promise<void> {
      const project = options.project()
      const assets = options.assets()
      setRepeating(enabled)
      runtime.setRepeat(enabled)
      if (project) await runtime.setSnapshot(project, assets)
    },
    playing: isPlaying,
    /** The playhead for readouts: ten times a second while the song plays. */
    playheadFrame: readout.frame,
    /** The frame heard this moment, for an action taken now, such as a split. */
    frameNow: () => runtime.frameNow(),
    /** Call `tick` on every transport tick until the returned function runs. */
    ticks(tick: () => void): () => void {
      ticks.add(tick)
      return () => ticks.delete(tick)
    },
    peakL: () => state().peakL,
    peakR: () => state().peakR,
    meter: () => state().meter,
    meterReady,
    /** A lane's level after its fader while the song plays; undefined when it is not heard. */
    laneLevel: (trackId: string) => laneLevels().get(trackId),
    masterReady,
    resetPeakHold: () => runtime.resetPeakHold(),
    /** Play a lane's moving fader or pan without saving it; null ends it. */
    previewLane: (trackId: string, draft: StudioLaneDraft | null) =>
      runtime.previewLane(trackId, draft),
    /** Play a moving macro dial or slider without saving it; null ends it. */
    previewMacro: (name: MacroKey, value: number | null) =>
      runtime.previewMacro(name, value),
    async setMasterGain(value: StudioMasterGainToken): Promise<void> {
      const project = options.project()
      const assets = options.assets()
      if (
        !project ||
        project.id !== value.projectId ||
        project.revision !== value.revision ||
        disposed
      )
        return
      try {
        runtime.setMasterGain(value)
        await runtime.setSnapshot(project, assets)
      } catch (error) {
        if (!disposed)
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'The prepared master could not be applied.',
          )
      }
    },
    pending: () => statePending() || previewPending(),
    error: () => previewError() ?? stateError(),
    previewing,
    previewPending,
    previewPositionSeconds: () => preview?.player.currentTime ?? 0,
    play,
    pause: () => runtime.pause(),
    stop() {
      stopPreview()
      runtime.stop()
    },
    async seek(frame: number): Promise<void> {
      const project = options.project()
      const assets = options.assets()
      if (project) await runtime.seek(frame, project, assets)
    },
    previewSource,
    primeAudio,
    stopPreview,
    releaseAudio,
    dispose,
  }
}
