// ============================================================
// Karaoke Voice Capture Controller — temporary dry replay beside scoring
// ============================================================
//
// The controller follows playback rather than microphone ownership: enabling
// the scoring mic alone never starts a persistent recording. A scored stop
// prepares one in-memory take; only Keep writes it to Hear Yourself.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { KaraokeVoiceTakeCapture } from '@/lib/domain/karaoke-voice-take'
import { keepKaraokeVoiceTake } from '@/lib/domain/karaoke-voice-take'
import type { MicScore } from '@/lib/mic-scoring'
import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, inspectVoiceTake } from '@/lib/voice-capture'
import type { VoiceAtlasRawFrame } from '@/lib/voice-contour'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

export type KaraokeVoiceCaptureState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'unsupported'
  | 'error'

interface KaraokeVoiceCaptureDependencies {
  sessionId: string
  songTitle: string
  getStream: () => MediaStream | null
  getAudioContext: () => AudioContext | null
  createRecorder?: (stream: MediaStream) => TakeRecorder | null
  inspectTake?: typeof inspectVoiceTake
  saveTake?: typeof keepKaraokeVoiceTake
  nowMs?: () => number
  nowIso?: () => string
}

export interface KaraokeVoiceCaptureController {
  state: Accessor<KaraokeVoiceCaptureState>
  message: Accessor<string>
  startPlayback: () => void
  pausePlayback: () => void
  pushMicFrame: (frame: Omit<VoiceAtlasRawFrame, 't'>) => void
  finishScoredPlayback: (score: MicScore | null) => void
  keep: () => Promise<boolean>
  dismiss: () => void
}

export function syncKaraokeCaptureWithMic(
  capture: Pick<
    KaraokeVoiceCaptureController,
    'state' | 'startPlayback' | 'dismiss'
  >,
  micActive: boolean,
  playbackActive: boolean,
): void {
  if (!micActive) {
    if (capture.state() === 'recording' || capture.state() === 'paused') {
      capture.dismiss()
    }
    return
  }
  if (playbackActive) capture.startPlayback()
}

export function useKaraokeVoiceCaptureController(
  deps: KaraokeVoiceCaptureDependencies,
): KaraokeVoiceCaptureController {
  const [state, setState] = createSignal<KaraokeVoiceCaptureState>('idle')
  const [message, setMessage] = createSignal('')
  const recorderFactory = deps.createRecorder ?? createTakeRecorder
  const inspectTake = deps.inspectTake ?? inspectVoiceTake
  const saveTake = deps.saveTake ?? keepKaraokeVoiceTake
  const nowMs = deps.nowMs ?? (() => performance.now())
  const nowIso = deps.nowIso ?? (() => new Date().toISOString())

  let recorder: TakeRecorder | null = null
  let capture: KaraokeVoiceTakeCapture | null = null
  let frames: VoiceAtlasRawFrame[] = []
  let capturedAt = ''
  let activeDurationMs = 0
  let activeSegmentStartedAt: number | null = null
  let generation = 0
  let playbackRequested = false
  let transportTransitioning = false
  let transportTransitionId = 0
  let disposed = false

  const beginClock = (): void => {
    activeSegmentStartedAt = nowMs()
  }

  const pauseClock = (): void => {
    if (activeSegmentStartedAt === null) return
    activeDurationMs += Math.max(0, nowMs() - activeSegmentStartedAt)
    activeSegmentStartedAt = null
  }

  const currentDurationMs = (): number =>
    activeDurationMs +
    (activeSegmentStartedAt === null
      ? 0
      : Math.max(0, nowMs() - activeSegmentStartedAt))

  const resetPreparedTake = (): void => {
    capture = null
    frames = []
    capturedAt = ''
    activeDurationMs = 0
    activeSegmentStartedAt = null
    setMessage('')
  }

  const discardRecorder = (): void => {
    recorder?.discard()
    recorder?.dispose()
    recorder = null
  }

  const invalidateTransportTransition = (): void => {
    transportTransitionId += 1
    transportTransitioning = false
  }

  /** Follow the latest playback intent only after MediaRecorder is ready. */
  const reconcileRecorderTransport = (): void => {
    const current = recorder
    if (disposed || current === null || transportTransitioning) return
    const shouldResume = playbackRequested && state() === 'paused'
    const shouldPause = !playbackRequested && state() === 'recording'
    if (!shouldResume && !shouldPause) return

    const run = generation
    const transitionId = ++transportTransitionId
    transportTransitioning = true
    const transition = shouldResume ? current.resume() : current.pause()
    void transition
      .catch(() => false)
      .then((ready) => {
        if (transitionId !== transportTransitionId) return
        transportTransitioning = false
        if (disposed || run !== generation || recorder !== current || !ready)
          return

        if (shouldResume) {
          beginClock()
          setState('recording')
        } else {
          pauseClock()
          setState('paused')
        }
        // Playback may have changed again while MediaRecorder queued its event.
        reconcileRecorderTransport()
      })
  }

  const startPlayback = (): void => {
    if (disposed || state() === 'processing' || state() === 'saving') return
    playbackRequested = true
    if (recorder !== null) {
      reconcileRecorderTransport()
      return
    }

    const stream = deps.getStream()
    if (stream === null) return
    generation += 1
    resetPreparedTake()
    const next = recorderFactory(stream)
    if (next === null) {
      setState('unsupported')
      setMessage(
        'Pitch scoring worked, but this browser cannot prepare an audio replay.',
      )
      return
    }
    if (!next.start()) {
      next.dispose()
      setState('error')
      setMessage(
        'The microphone replay could not start. Your score still works.',
      )
      return
    }
    invalidateTransportTransition()
    recorder = next
    capturedAt = nowIso()
    beginClock()
    setState('recording')
  }

  const pausePlayback = (): void => {
    playbackRequested = false
    reconcileRecorderTransport()
  }

  const pushMicFrame = (frame: Omit<VoiceAtlasRawFrame, 't'>): void => {
    if (state() !== 'recording') return
    frames.push({
      t: currentDurationMs() / 1000,
      f0: frame.f0,
      conf: frame.conf,
      rms: frame.rms,
    })
  }

  const finishScoredPlayback = (score: MicScore | null): void => {
    const current = recorder
    if (current === null) return
    playbackRequested = false
    invalidateTransportTransition()
    if (score === null) {
      generation += 1
      discardRecorder()
      resetPreparedTake()
      setState('idle')
      return
    }

    if (state() === 'recording') pauseClock()
    recorder = null
    const run = ++generation
    const fallbackDurationMs = Math.max(0, Math.round(activeDurationMs))
    const takeFrames = frames
    const takeCapturedAt = capturedAt
    setState('processing')
    setMessage('Preparing your private microphone replay on this device.')

    void (async () => {
      const blob = await current.stop()
      current.dispose()
      if (disposed || run !== generation) return
      if (blob === null || blob.size === 0) {
        resetPreparedTake()
        setState('error')
        setMessage(
          'Your score is safe, but no replay audio was captured. Check the selected microphone and try again.',
        )
        return
      }
      const inspection = await inspectTake(
        blob,
        deps.getAudioContext(),
        fallbackDurationMs,
      )
      if (disposed || run !== generation) return
      if (inspection.durationMs <= 0) {
        resetPreparedTake()
        setState('error')
        setMessage(
          'Your score is safe, but the replay could not be prepared in this browser.',
        )
        return
      }
      capture = {
        blob,
        durationMs: inspection.durationMs,
        peaks: inspection.peaks,
        capturedAt: takeCapturedAt,
        contour: encodeVoiceAtlasContour(takeFrames, {
          source: 'f0-stream-yin-v1',
        }),
        score,
      }
      setState('ready')
      setMessage(
        'Dry microphone audio is ready. Nothing is saved until you keep it.',
      )
    })()
  }

  const keep = async (): Promise<boolean> => {
    const take = capture
    if (take === null || state() !== 'ready') return false
    setState('saving')
    setMessage('Keeping this take in Hear Yourself on this device.')
    let result: Awaited<ReturnType<typeof saveTake>>
    try {
      result = await saveTake({
        sessionId: deps.sessionId,
        songTitle: deps.songTitle,
        take,
      })
    } catch {
      if (disposed) return false
      setState('ready')
      setMessage(
        'The take could not be kept. Your temporary replay is still ready.',
      )
      return false
    }
    if (disposed) return false
    if (result.ok) {
      setState('saved')
      setMessage('Kept in Hear Yourself. The song audio was not stored.')
      return true
    }
    setState('ready')
    setMessage(
      result.quotaExceeded
        ? 'This device does not have enough local space for the take.'
        : 'The take could not be kept. Your temporary replay is still ready.',
    )
    return false
  }

  const dismiss = (): void => {
    // Keep owns the only durable copy while its write is in flight. A score
    // close, Escape, or transport callback must not invalidate that promise
    // and drop the temporary replay before a failed write can offer Retry.
    if (state() === 'saving') return
    generation += 1
    playbackRequested = false
    invalidateTransportTransition()
    discardRecorder()
    resetPreparedTake()
    setState('idle')
  }

  onCleanup(() => {
    disposed = true
    generation += 1
    playbackRequested = false
    invalidateTransportTransition()
    discardRecorder()
    capture = null
    frames = []
  })

  return {
    state,
    message,
    startPlayback,
    pausePlayback,
    pushMicFrame,
    finishScoredPlayback,
    keep,
    dismiss,
  }
}
