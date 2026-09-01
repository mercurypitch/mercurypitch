// ============================================================
// Drum performance capture — pooled live-kit replay across transport segments
// ============================================================
//
// Capture follows Take-events playback and pauses with the transport. The
// player supplies a live-lane-only stream, so authored drums, backing, click,
// and microphone audio never enter the temporary replay.

import type { Accessor } from 'solid-js'
import { onCleanup } from 'solid-js'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import type { PerformanceTakeKeepState } from '@/lib/use-performance-take-keep'
import { usePerformanceTakeKeep } from '@/lib/use-performance-take-keep'
import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, inspectVoiceTake } from '@/lib/voice-capture'
import type { KeepDrumPerformanceTakeInput } from './persistence/drum-performance-take'
import { keepDrumPerformanceTake } from './persistence/drum-performance-take'
import type { DrumTakeSummary } from './persistence/drum-take-summary'
import { validateDrumTakeSummary } from './persistence/drum-take-summary'

export interface DrumPerformanceTakeCaptureDependencies {
  readonly getStream: () => MediaStream | null
  readonly getAudioContext: () => AudioContext | null
  readonly createRecorder?: (stream: MediaStream) => TakeRecorder | null
  readonly inspectTake?: typeof inspectVoiceTake
  readonly saveTake?: (
    input: KeepDrumPerformanceTakeInput,
  ) => ReturnType<typeof keepDrumPerformanceTake>
  readonly nowMs?: () => number
  readonly nowIso?: () => string
}

export interface DrumPerformanceTakeCaptureController {
  readonly state: Accessor<PerformanceTakeKeepState>
  readonly message: Accessor<string>
  readonly startPlayback: () => void
  readonly pausePlayback: () => void
  readonly finish: (summary: DrumTakeSummary, projectTitle: string) => void
  readonly keep: () => Promise<boolean>
  readonly dismiss: () => boolean
}

export function useDrumPerformanceTakeCaptureController(
  deps: DrumPerformanceTakeCaptureDependencies,
): DrumPerformanceTakeCaptureController {
  const keepBoundary = usePerformanceTakeKeep()
  useLocalSaveNavigationLock(
    () => keepBoundary.state() === 'saving',
    'drum-night take keep',
  )
  const recorderFactory = deps.createRecorder ?? createTakeRecorder
  const inspectTake = deps.inspectTake ?? inspectVoiceTake
  const saveTake = deps.saveTake ?? keepDrumPerformanceTake
  const nowMs = deps.nowMs ?? (() => performance.now())
  const nowIso = deps.nowIso ?? (() => new Date().toISOString())

  let recorder: TakeRecorder | null = null
  let capturedAt = ''
  let activeDurationMs = 0
  let activeSegmentStartedAt: number | null = null
  let playbackRequested = false
  let transportTransitioning = false
  let transportTransitionId = 0
  let generation = 0
  let disposed = false

  const beginClock = (): void => {
    activeSegmentStartedAt = nowMs()
  }

  const pauseClock = (): void => {
    if (activeSegmentStartedAt === null) return
    activeDurationMs += Math.max(0, nowMs() - activeSegmentStartedAt)
    activeSegmentStartedAt = null
  }

  const resetClock = (): void => {
    capturedAt = ''
    activeDurationMs = 0
    activeSegmentStartedAt = null
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

  const reconcileRecorderTransport = (): void => {
    const current = recorder
    if (disposed || current === null || transportTransitioning) return
    const shouldResume = playbackRequested && activeSegmentStartedAt === null
    const shouldPause = !playbackRequested && activeSegmentStartedAt !== null
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
        if (disposed || run !== generation || recorder !== current) {
          return
        }
        if (!ready) {
          generation += 1
          recorder = null
          current.discard()
          current.dispose()
          resetClock()
          keepBoundary.fail(
            'The compact summary still works, but replay capture could not follow the transport.',
          )
          return
        }
        if (shouldResume) beginClock()
        else pauseClock()
        reconcileRecorderTransport()
      })
  }

  const dismiss = (): boolean => {
    if (!keepBoundary.dismiss()) return false
    generation += 1
    playbackRequested = false
    invalidateTransportTransition()
    discardRecorder()
    resetClock()
    return true
  }

  const startPlayback = (): void => {
    if (disposed) return
    const state = keepBoundary.state()
    if (state === 'processing' || state === 'ready' || state === 'saving') {
      return
    }
    playbackRequested = true
    if (recorder !== null) {
      reconcileRecorderTransport()
      return
    }
    if (state !== 'idle' && !dismiss()) return
    playbackRequested = true

    const stream = deps.getStream()
    if (stream === null) {
      keepBoundary.unsupported(
        'The compact summary still works, but this browser cannot prepare a live-kit replay.',
      )
      return
    }
    const next = recorderFactory(stream)
    if (next === null) {
      keepBoundary.unsupported(
        'The compact summary still works, but this browser cannot encode a live-kit replay.',
      )
      return
    }
    if (!next.start()) {
      next.dispose()
      keepBoundary.fail(
        'The compact summary still works, but live-kit replay capture could not start.',
      )
      return
    }
    generation += 1
    invalidateTransportTransition()
    recorder = next
    resetClock()
    capturedAt = nowIso()
    beginClock()
    keepBoundary.beginCapture('Capturing only your live kit on this device.')
  }

  const pausePlayback = (): void => {
    playbackRequested = false
    reconcileRecorderTransport()
  }

  const finish = (summary: DrumTakeSummary, projectTitle: string): void => {
    if (disposed) return
    let frozenSummary: DrumTakeSummary
    try {
      frozenSummary = validateDrumTakeSummary(summary)
    } catch {
      discardRecorder()
      resetClock()
      keepBoundary.fail(
        'The compact summary was saved, but its replay metadata could not be prepared.',
      )
      return
    }

    const current = recorder
    playbackRequested = false
    invalidateTransportTransition()
    if (current === null) {
      if (keepBoundary.state() === 'idle') {
        keepBoundary.unsupported(
          'The compact summary was saved, but no live-kit replay was available.',
        )
      }
      return
    }

    pauseClock()
    recorder = null
    const run = ++generation
    const fallbackDurationMs = Math.max(0, Math.round(activeDurationMs))
    const takeCapturedAt = capturedAt || frozenSummary.completedAt
    keepBoundary.beginProcessing(
      'Summary saved. Preparing your private live-kit replay.',
    )

    void (async () => {
      const blob = await current.stop()
      current.dispose()
      if (disposed || run !== generation) return
      if (blob === null || blob.size === 0) {
        resetClock()
        keepBoundary.fail(
          'The compact summary is safe, but no live-kit replay audio was captured.',
        )
        return
      }
      const inspection = await inspectTake(
        blob,
        deps.getAudioContext(),
        fallbackDurationMs,
      )
      if (disposed || run !== generation) return
      if (
        inspection.durationMs <= 0 ||
        (inspection.peakAmplitude !== null &&
          inspection.peakAmplitude !== undefined &&
          inspection.peakAmplitude <= 0.0001)
      ) {
        resetClock()
        keepBoundary.fail(
          'The compact summary is safe, but the live-kit replay was silent or unreadable.',
        )
        return
      }
      const audio = {
        blob,
        durationMs: inspection.durationMs,
        peaks: inspection.peaks,
        capturedAt: takeCapturedAt,
      }
      resetClock()
      keepBoundary.ready(
        () => saveTake({ summary: frozenSummary, projectTitle, audio }),
        'Live-kit replay ready. Nothing is saved until you keep it.',
      )
    })().catch(() => {
      current.dispose()
      if (disposed || run !== generation) return
      resetClock()
      keepBoundary.fail(
        'The compact summary is safe, but the live-kit replay could not be prepared.',
      )
    })
  }

  onCleanup(() => {
    disposed = true
    generation += 1
    playbackRequested = false
    invalidateTransportTransition()
    discardRecorder()
    resetClock()
  })

  return {
    state: keepBoundary.state,
    message: keepBoundary.message,
    startPlayback,
    pausePlayback,
    finish,
    keep: keepBoundary.keep,
    dismiss,
  }
}
