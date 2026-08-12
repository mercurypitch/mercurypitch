// ============================================================
// Dry Voice Capture Controller — reusable local mic recording and review
// ============================================================
//
// Owns the full temporary-capture lifecycle but never persists a take. Guided
// checks can pause between sung windows: each segment drains its own raw F0
// frames and is placed on the encoded audio clock with pauses excluded.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { createMediaProgressLoop, isMediaPlaybackActive, } from '@/lib/media-progress-loop'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, inspectVoiceTake } from '@/lib/voice-capture'

export type DryVoiceCaptureState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'unsupported'

export interface DryVoiceCaptureSegment {
  /** Zero-based sung-window index. */
  index: number
  /** Start on the encoded take clock; paused time is deliberately excluded. */
  audioOffsetMs: number
  /** Active capture time represented by this segment. */
  durationMs: number
  /** Raw detector frames whose `t` starts at zero for this sung window. */
  frames: readonly PitchFrame[]
}

export interface DryVoiceCaptureResult {
  blob: Blob
  durationMs: number
  peaks: Float32Array
  capturedAt: string
  /** Raw frames on the continuous encoded-audio clock. */
  frames: readonly PitchFrame[]
  /** Per-window raw frames and their offsets into the encoded take. */
  segments: readonly DryVoiceCaptureSegment[]
  /** Absolute decoded PCM peak before display-waveform normalization. */
  peakAmplitude: number | null
  /** Whether the raw F0 analyser was available for this capture. */
  pitchAnalysisAvailable: boolean
  /** Whether the original microphone track stayed live for the whole take. */
  microphoneContinuous: boolean
  sampleRateHz: number | null
}

export interface DryVoiceCaptureController {
  state: Accessor<DryVoiceCaptureState>
  capture: Accessor<DryVoiceCaptureResult | null>
  elapsedMs: Accessor<number>
  message: Accessor<string | null>
  previewUrl: Accessor<string | null>
  previewPlaying: Accessor<boolean>
  previewProgress: Accessor<number>
  previewCurrentTimeMs: Accessor<number>
  previewDurationMs: Accessor<number>
  latestFrame: () => PitchFrame | null
  latestSmoothedFrame: () => PitchFrame | null
  latestLevel: () => number
  maxLevel: () => number
  /** Acquire and arm capture; `paused` keeps reference audio out of the take. */
  start: (options?: { paused?: boolean }) => Promise<boolean>
  /** Pause encoding and return the just-finished sung window. */
  pauseSegment: () => Promise<DryVoiceCaptureSegment | null>
  /** Resume encoding and reset the raw F0 clock for the next sung window. */
  resumeSegment: () => Promise<boolean>
  stop: () => Promise<DryVoiceCaptureResult | null>
  togglePreview: () => void
  /** Seek the temporary replay without changing whether it is playing. */
  seekPreview: (timeSec: number) => boolean
  discard: () => void
}

export interface DryVoiceCaptureOptions {
  consumerId: string
  maxDurationMs?: number
}

const DEFAULT_MAX_CAPTURE_MS = 5 * 60 * 1000

interface CaptureContinuityMonitor {
  snapshot: () => boolean
  dispose: () => void
}

/** Permanently records any interruption to the acquired audio track. */
function monitorCaptureContinuity(
  stream: MediaStream,
): CaptureContinuityMonitor {
  const tracks = stream.getAudioTracks()
  let continuous =
    tracks.length > 0 &&
    tracks.every((track) => track.readyState === 'live' && !track.muted)
  let disposed = false

  const markInterrupted = (): void => {
    continuous = false
  }
  const handleRemovedTrack = (event: Event): void => {
    const removedTrack = (event as MediaStreamTrackEvent).track
    if (tracks.some((track) => track === removedTrack)) markInterrupted()
  }

  for (const track of tracks) {
    track.addEventListener('ended', markInterrupted)
    track.addEventListener('mute', markInterrupted)
  }
  stream.addEventListener('inactive', markInterrupted)
  stream.addEventListener('removetrack', handleRemovedTrack)

  return {
    snapshot: () => {
      if (!continuous) return false
      try {
        const currentTracks = stream.getAudioTracks()
        return (
          tracks.length > 0 &&
          tracks.every(
            (track) =>
              currentTracks.includes(track) &&
              track.readyState === 'live' &&
              !track.muted,
          )
        )
      } catch {
        return false
      }
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const track of tracks) {
        track.removeEventListener('ended', markInterrupted)
        track.removeEventListener('mute', markInterrupted)
      }
      stream.removeEventListener('inactive', markInterrupted)
      stream.removeEventListener('removetrack', handleRemovedTrack)
    },
  }
}

function createCaptureAudioContext(): AudioContext | null {
  const WindowAudioContext =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext
  if (WindowAudioContext === undefined) return null
  try {
    return new WindowAudioContext()
  } catch {
    return null
  }
}

/** Stop one contour stream, preserving its raw frames before graph teardown. */
export function drainPitchStream(stream: F0Stream | null): PitchFrame[] {
  if (stream === null) return []
  const frames = stream.takeFrames()
  stream.dispose()
  return frames
}

export function useDryVoiceCapture(
  options: DryVoiceCaptureOptions,
): DryVoiceCaptureController {
  const [state, setState] = createSignal<DryVoiceCaptureState>('idle')
  const [capture, setCapture] = createSignal<DryVoiceCaptureResult | null>(null)
  const [elapsedMs, setElapsedMs] = createSignal(0)
  const [message, setMessage] = createSignal<string | null>(null)
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = createSignal(false)
  const [previewProgress, setPreviewProgress] = createSignal(0)
  const [previewCurrentTimeMs, setPreviewCurrentTimeMs] = createSignal(0)
  const [previewDurationMs, setPreviewDurationMs] = createSignal(0)
  let previewAudio: HTMLAudioElement | null = null
  const previewProgressLoop = createMediaProgressLoop((progress) => {
    setPreviewProgress(progress)
    const mediaTimeMs = (previewAudio?.currentTime ?? 0) * 1000
    setPreviewCurrentTimeMs(
      Number.isFinite(mediaTimeMs)
        ? Math.max(0, mediaTimeMs)
        : progress * previewDurationMs(),
    )
  })
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_CAPTURE_MS

  let recorder: TakeRecorder | null = null
  let pitchStream: F0Stream | null = null
  let captureContext: AudioContext | null = null
  let elapsedTimer: ReturnType<typeof setInterval> | null = null
  let capTimer: ReturnType<typeof setTimeout> | null = null
  let capturedAt = ''
  let segmentStartedAt = 0
  let completedDurationMs = 0
  let segments: DryVoiceCaptureSegment[] = []
  let activeRun = 0
  let continuityMonitor: CaptureContinuityMonitor | null = null
  let pendingPreviewSeekSec: number | null = null
  let unregisterMicIndicator = (): void => undefined

  const currentDurationMs = (): number =>
    completedDurationMs +
    (state() === 'recording' ? Math.max(0, Date.now() - segmentStartedAt) : 0)

  function clearTimers(): void {
    if (elapsedTimer !== null) clearInterval(elapsedTimer)
    if (capTimer !== null) clearTimeout(capTimer)
    elapsedTimer = null
    capTimer = null
  }

  function startTimers(): void {
    clearTimers()
    elapsedTimer = setInterval(() => setElapsedMs(currentDurationMs()), 250)
    const remainingMs = Math.max(0, maxDurationMs - completedDurationMs)
    capTimer = setTimeout(() => void stop(), remainingMs)
  }

  function releaseMic(): void {
    micManager.release(options.consumerId)
  }

  function closeCaptureContext(context = captureContext): void {
    if (context === null) return
    if (captureContext === context) captureContext = null
    if (context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }

  function disposePitchStream(): void {
    const current = pitchStream
    pitchStream = null
    current?.dispose()
  }

  function clearPreview(): void {
    previewProgressLoop.stop()
    previewAudio?.pause()
    previewAudio = null
    const url = previewUrl()
    if (url !== null) URL.revokeObjectURL(url)
    setPreviewUrl(null)
    setPreviewPlaying(false)
    setPreviewProgress(0)
    setPreviewCurrentTimeMs(0)
    setPreviewDurationMs(0)
    pendingPreviewSeekSec = null
  }

  function resetCaptureData(): void {
    segments = []
    completedDurationMs = 0
    segmentStartedAt = 0
    capturedAt = ''
    setCapture(null)
    setElapsedMs(0)
  }

  function disposeContinuityMonitor(monitor = continuityMonitor): void {
    if (monitor === null) return
    monitor.dispose()
    if (continuityMonitor === monitor) continuityMonitor = null
  }

  function discard(): void {
    activeRun += 1
    clearTimers()
    recorder?.discard()
    recorder?.dispose()
    recorder = null
    disposeContinuityMonitor()
    disposePitchStream()
    releaseMic()
    closeCaptureContext()
    clearPreview()
    resetCaptureData()
    setMessage(null)
    setState('idle')
  }

  function handleMicLoss(): void {
    discard()
    setMessage(
      'The microphone stopped before the take was ready. Check the input and record again.',
    )
  }

  onMount(() => {
    unregisterMicIndicator = registerMicIndicator(
      options.consumerId,
      // Deliberately non-reactive: the sentinel polls this accessor on its
      // own watchdog interval instead of subscribing inside Solid's graph.
      // eslint-disable-next-line solid/reactivity
      () => state() === 'recording' || state() === 'paused',
      handleMicLoss,
    )
  })

  onCleanup(() => {
    activeRun += 1
    clearTimers()
    recorder?.discard()
    recorder?.dispose()
    recorder = null
    disposeContinuityMonitor()
    disposePitchStream()
    releaseMic()
    closeCaptureContext()
    clearPreview()
    unregisterMicIndicator()
  })

  async function start(startOptions?: { paused?: boolean }): Promise<boolean> {
    discard()
    setState('starting')
    const run = ++activeRun
    const context = createCaptureAudioContext()
    captureContext = context
    let nextContinuityMonitor: CaptureContinuityMonitor | null = null

    try {
      if (context?.state === 'suspended') await context.resume()
      const stream = await micManager.acquire(options.consumerId)
      if (run !== activeRun) {
        releaseMic()
        return false
      }
      nextContinuityMonitor = monitorCaptureContinuity(stream)
      continuityMonitor = nextContinuityMonitor

      const nextRecorder = createTakeRecorder(stream)
      if (nextRecorder === null) {
        disposeContinuityMonitor(nextContinuityMonitor)
        releaseMic()
        closeCaptureContext(context)
        setState('unsupported')
        return false
      }
      if (nextRecorder.start() === false) {
        nextRecorder.dispose()
        disposeContinuityMonitor(nextContinuityMonitor)
        releaseMic()
        closeCaptureContext(context)
        setState('idle')
        setMessage(
          'No audio was captured. Check the selected input and record again.',
        )
        return false
      }
      recorder = nextRecorder
      if (startOptions?.paused === true) {
        const paused = await nextRecorder.pause()
        if (run !== activeRun || recorder !== nextRecorder) return false
        if (!paused) {
          recorder = null
          nextRecorder.discard()
          nextRecorder.dispose()
          disposeContinuityMonitor(nextContinuityMonitor)
          releaseMic()
          closeCaptureContext(context)
          setState('idle')
          setMessage(
            'The microphone could not wait between prompts in this browser.',
          )
          return false
        }
      }
      if (run !== activeRun || recorder !== nextRecorder) {
        nextRecorder.discard()
        nextRecorder.dispose()
        disposeContinuityMonitor(nextContinuityMonitor)
        releaseMic()
        closeCaptureContext(context)
        return false
      }

      if (context !== null) {
        try {
          pitchStream = createF0Stream(context, stream)
          if (startOptions?.paused !== true) pitchStream.startTask()
        } catch {
          pitchStream = null
        }
      }
      const startedAt = Date.now()
      capturedAt = new Date(startedAt).toISOString()
      segmentStartedAt = startedAt
      setElapsedMs(0)
      setState(startOptions?.paused === true ? 'paused' : 'recording')
      if (startOptions?.paused !== true) startTimers()
      return true
    } catch (error) {
      if (run !== activeRun) return false
      recorder?.discard()
      recorder?.dispose()
      recorder = null
      disposeContinuityMonitor(nextContinuityMonitor)
      disposePitchStream()
      releaseMic()
      closeCaptureContext(context)
      setState('idle')
      setMessage(
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'The microphone could not open. Check browser permission and try again.',
      )
      return false
    }
  }

  function finishSegment(): DryVoiceCaptureSegment {
    const durationMs = Math.max(0, Date.now() - segmentStartedAt)
    const frames = pitchStream?.takeFrames() ?? []
    const segment: DryVoiceCaptureSegment = {
      index: segments.length,
      audioOffsetMs: completedDurationMs,
      durationMs,
      frames,
    }
    segments = [...segments, segment]
    completedDurationMs += durationMs
    segmentStartedAt = 0
    setElapsedMs(completedDurationMs)
    return segment
  }

  async function pauseSegment(): Promise<DryVoiceCaptureSegment | null> {
    if (state() !== 'recording' || recorder === null) return null
    const currentRecorder = recorder
    if (!(await currentRecorder.pause())) return null
    if (state() !== 'recording' || recorder !== currentRecorder) return null
    clearTimers()
    const segment = finishSegment()
    setState('paused')
    return segment
  }

  async function resumeSegment(): Promise<boolean> {
    if (state() !== 'paused' || recorder === null) return false
    const currentRecorder = recorder
    if (!(await currentRecorder.resume())) return false
    if (state() !== 'paused' || recorder !== currentRecorder) return false
    pitchStream?.startTask()
    segmentStartedAt = Date.now()
    setState('recording')
    startTimers()
    return true
  }

  async function stop(): Promise<DryVoiceCaptureResult | null> {
    if ((state() !== 'recording' && state() !== 'paused') || recorder === null)
      return null

    const wasRecording = state() === 'recording'
    const currentRecorder = recorder
    const context = captureContext
    const pitchAnalysisAvailable = pitchStream !== null
    const currentContinuityMonitor = continuityMonitor
    const microphoneContinuous = currentContinuityMonitor?.snapshot() ?? false
    disposeContinuityMonitor(currentContinuityMonitor)
    const sampleRateHz = context?.sampleRate ?? null
    const run = activeRun
    recorder = null
    clearTimers()
    if (wasRecording) finishSegment()
    const takeSegments = segments
    const fallbackDurationMs = completedDurationMs
    setState('processing')
    releaseMic()
    disposePitchStream()

    try {
      const blob = await currentRecorder.stop()
      currentRecorder.dispose()
      if (run !== activeRun) {
        closeCaptureContext(context)
        return null
      }
      if (blob === null) {
        closeCaptureContext(context)
        setState('idle')
        setMessage(
          'No audio was captured. Check the selected input and record again.',
        )
        return null
      }

      const inspection = await inspectVoiceTake(
        blob,
        context,
        fallbackDurationMs,
      )
      if (run !== activeRun) {
        closeCaptureContext(context)
        return null
      }
      closeCaptureContext(context)
      const inspectedDurationMs =
        Number.isFinite(inspection.durationMs) && inspection.durationMs > 0
          ? inspection.durationMs
          : fallbackDurationMs
      if (blob.size === 0 || inspectedDurationMs <= 0) {
        setElapsedMs(0)
        setState('idle')
        setMessage(
          'No audio was captured. Check the selected input and record again.',
        )
        return null
      }

      const frames = takeSegments.flatMap((segment) =>
        segment.frames.map((frame) => ({
          ...frame,
          t: frame.t + segment.audioOffsetMs / 1000,
        })),
      )
      const result: DryVoiceCaptureResult = {
        blob,
        durationMs: inspectedDurationMs,
        peaks: inspection.peaks,
        capturedAt,
        frames,
        segments: takeSegments,
        peakAmplitude: inspection.peakAmplitude ?? null,
        pitchAnalysisAvailable,
        microphoneContinuous,
        sampleRateHz,
      }
      setCapture(result)
      setPreviewUrl(URL.createObjectURL(blob))
      setPreviewDurationMs(inspectedDurationMs)
      setElapsedMs(inspectedDurationMs)
      setState('ready')
      return result
    } catch {
      currentRecorder.dispose()
      if (run !== activeRun) return null
      closeCaptureContext(context)
      setState('idle')
      setMessage(
        'No audio was captured. Check the selected input and record again.',
      )
      return null
    }
  }

  function ensurePreviewAudio(): HTMLAudioElement | null {
    const url = previewUrl()
    if (url === null) return null
    if (previewAudio !== null) return previewAudio

    const nextAudio = new Audio(url)
    nextAudio.setAttribute('playsinline', '')
    previewAudio = nextAudio
    nextAudio.addEventListener('loadedmetadata', () => {
      if (previewAudio !== nextAudio) return
      if (Number.isFinite(nextAudio.duration) && nextAudio.duration > 0) {
        setPreviewDurationMs(nextAudio.duration * 1000)
      }
      const pending = pendingPreviewSeekSec
      if (pending === null) return
      pendingPreviewSeekSec = null
      try {
        nextAudio.currentTime = Math.min(pending, nextAudio.duration || pending)
        previewProgressLoop.start(nextAudio)
      } catch {
        // The known capture duration still keeps the visual marker useful.
      }
    })
    nextAudio.addEventListener('timeupdate', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.sample(nextAudio)
    })
    nextAudio.addEventListener('play', () => {
      if (previewAudio !== nextAudio) return
      setPreviewPlaying(true)
      previewProgressLoop.start(nextAudio)
    })
    nextAudio.addEventListener('pause', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.sample(nextAudio)
      previewProgressLoop.stop()
      setPreviewPlaying(false)
    })
    nextAudio.addEventListener('ended', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.stop()
      setPreviewPlaying(false)
      setPreviewProgress(1)
      setPreviewCurrentTimeMs(previewDurationMs())
    })
    nextAudio.addEventListener('error', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.stop()
      setPreviewPlaying(false)
      setMessage(
        'This browser could not replay the temporary take, but you can still keep the original audio.',
      )
    })
    return nextAudio
  }

  function togglePreview(): void {
    const currentAudio = ensurePreviewAudio()
    if (currentAudio === null) return
    if (!currentAudio.paused) {
      previewProgressLoop.sample(currentAudio)
      previewProgressLoop.stop()
      currentAudio.pause()
      setPreviewPlaying(false)
      return
    }

    void currentAudio
      .play()
      .then(() => {
        if (
          previewAudio !== currentAudio ||
          !isMediaPlaybackActive(currentAudio)
        )
          return
        setPreviewPlaying(true)
        previewProgressLoop.start(currentAudio)
      })
      .catch(() => {
        if (previewAudio !== currentAudio) return
        setMessage('Playback was blocked. Tap play again to hear the take.')
      })
  }

  function seekPreview(timeSec: number): boolean {
    if (!Number.isFinite(timeSec) || previewUrl() === null) return false
    const durationSec = previewDurationMs() / 1000
    const targetSec = Math.max(
      0,
      durationSec > 0 ? Math.min(timeSec, durationSec) : timeSec,
    )
    const currentAudio = ensurePreviewAudio()
    if (currentAudio === null) return false
    try {
      currentAudio.currentTime = targetSec
      pendingPreviewSeekSec = null
      previewProgressLoop.start(currentAudio)
    } catch {
      pendingPreviewSeekSec = targetSec
    }
    setPreviewCurrentTimeMs(targetSec * 1000)
    setPreviewProgress(durationSec > 0 ? targetSec / durationSec : 0)
    return true
  }

  return {
    state,
    capture,
    elapsedMs,
    message,
    previewUrl,
    previewPlaying,
    previewProgress,
    previewCurrentTimeMs,
    previewDurationMs,
    latestFrame: () => pitchStream?.latest() ?? null,
    latestSmoothedFrame: () => pitchStream?.latestSmoothed() ?? null,
    latestLevel: () => pitchStream?.latestLevel() ?? 0,
    maxLevel: () => pitchStream?.maxLevel() ?? 0,
    start,
    pauseSegment,
    resumeSegment,
    stop,
    togglePreview,
    seekPreview,
    discard,
  }
}
