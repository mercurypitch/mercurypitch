// Studio transport hook — explicit playback and preview through the active host's borrowed clock.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { AudioContextLease } from '@/lib/audio-context-lease'
import type { PreviewPlayer } from '@/lib/preview-player'
import { createPreviewPlayer } from '@/lib/preview-player'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioTransportState } from '@/lib/studio/playback/transport'
import { createStudioTransport } from '@/lib/studio/playback/transport'
import { initAudioEngine } from '@/stores/app-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { createStudioWebLease } from './web-audio-lease'

export interface UseStudioTransportOptions {
  project: Accessor<StudioProject | null>
  assets: Accessor<readonly StudioAsset[]>
  readCanonicalAsset(assetId: string): Promise<Blob>
  audioLease?: AudioContextLease
  beforePlay?: () => void
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
  })
  const [repeating, setRepeating] = createSignal(false)
  const [previewPending, setPreviewPending] = createSignal(false)
  const [previewError, setPreviewError] = createSignal<string | null>(null)
  const [previewing, setPreviewing] = createSignal(false)
  const runtime = createStudioTransport({
    lease,
    readCanonicalAsset: options.readCanonicalAsset,
    changed: (value) => {
      if (!disposed) setState(value)
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

  function previewContext(blob: Blob): AudioContext {
    const ctx = lease.ensure()
    if (!ctx || ctx.state !== 'running')
      throw new Error('The audio device is not ready.')
    if (!blob.size || blob.size > 64 * 1024 * 1024)
      throw new Error('This take is too large to preview here.')
    return ctx
  }

  function previewFailure(
    played: boolean,
    player: PreviewPlayer,
  ): string | null {
    if (!played) return 'This take could not be previewed.'
    if (player.duration > 300)
      return 'Choose a take shorter than five minutes to preview in Studio.'
    return null
  }

  async function previewSource(blob: Blob): Promise<boolean> {
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
      // Unlock now; waiting for the song's release must not lose the gesture.
      await runtime.releaseAudio()
      await Promise.all(retiringPreviews)
      if (!(await unlocked))
        throw new Error('Audio could not start. Try Preview again.')
      if (disposed || token !== previewGeneration) return false
      const ctx = previewContext(blob)
      // Media decoding is browser-managed. Reserve the supported five-minute
      // stereo working allowance as well as encoded bytes, not just file size.
      release = reserveStudioMemory(
        blob.size * 2 + DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames * 2 * 4 * 2,
      )
      url = URL.createObjectURL(blob)
      player = createPreviewPlayer({
        audioGraph: { context: ctx, destination: ctx.destination },
        onEnded: stopPreview,
      })
      preview = { player, url, release }
      player = undefined
      url = undefined
      release = undefined
      const played = await preview.player.play(preview.url)
      if (disposed || token !== previewGeneration) return false
      const failure = previewFailure(played, preview.player)
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

  function onVisibility(): void {
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
    playing: () => state().playing,
    playheadFrame: () => state().playheadFrame,
    peakL: () => state().peakL,
    peakR: () => state().peakR,
    pending: () => state().pending || previewPending(),
    error: () => previewError() ?? state().error,
    previewing,
    previewPending,
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
