// ============================================================
// Guitar Night Take Capture — temporary dry replay for authored live scores
// ============================================================
//
// Scoring keeps its exact event evidence. This controller only records the
// already-owned Room mic or Direct input stream beside one admitted score run,
// then offers the prepared Blob to Hear Yourself after an explicit Keep.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { KeepInstrumentNightTakeInput, PreparedPerformanceTakeAudio, } from '@/lib/domain/performance-take'
import { keepInstrumentNightTake } from '@/lib/domain/performance-take'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { usePerformanceTakeKeep } from '@/lib/use-performance-take-keep'
import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, inspectVoiceTake } from '@/lib/voice-capture'
import type { GuitarNightScoreLiveBoundary } from './useGuitarNightScoreRoomController'

type ReplayableGuitarInputKind = Extract<
  GuitarInputProfileKind,
  'microphone' | 'interface'
>

interface GuitarNightTakeCaptureDependencies {
  getStream(): MediaStream | null
  getAudioContext(): AudioContext | null
  createRecorder?: (stream: MediaStream) => TakeRecorder | null
  inspectTake?: typeof inspectVoiceTake
  saveTake?: typeof keepInstrumentNightTake
  nowIso?: () => string
  visibilityTarget?: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  > | null
}

interface ActiveCapture {
  boundary: GuitarNightScoreLiveBoundary
  inputKind: ReplayableGuitarInputKind
  recorder: TakeRecorder
  context: AudioContext
  capturedAt: string | null
  startedAtSeconds: number | null
}

interface PreparedCapture {
  boundary: GuitarNightScoreLiveBoundary
  inputKind: ReplayableGuitarInputKind
  audio: PreparedPerformanceTakeAudio
}

// MediaRecorder does not expose a reliable cross-browser trim operation. A
// small scheduling tolerance absorbs ordinary timer jitter; beyond it, keeping
// the full Blob would falsely claim audio outside the authored score boundary.
const MAX_REPLAY_BOUNDARY_DRIFT_MS = 250

function hasMaterialBoundaryDrift(
  actualSeconds: number,
  expectedSeconds: number,
): boolean {
  return (
    !Number.isFinite(actualSeconds) ||
    !Number.isFinite(expectedSeconds) ||
    Math.abs(actualSeconds - expectedSeconds) * 1000 >
      MAX_REPLAY_BOUNDARY_DRIFT_MS
  )
}

function stableBeat(value: number): string {
  return String(Number(value.toFixed(6)))
}

/** Group repeated attempts at the same authored part and exact beat range. */
export function guitarNightTakeComparisonKey(
  boundary: GuitarNightScoreLiveBoundary,
): string {
  return [
    'guitar-night',
    encodeURIComponent(boundary.reference.songId),
    encodeURIComponent(boundary.reference.trackId),
    `${stableBeat(boundary.range.start)}-${stableBeat(boundary.range.end)}`,
    'v1',
  ].join(':')
}

/** Build the privacy-bounded payload shared Hear Yourself persists. */
export function guitarNightTakeKeepInput(input: {
  boundary: GuitarNightScoreLiveBoundary
  inputKind: ReplayableGuitarInputKind
  summary: GuitarScoreTakeSummary
  audio: PreparedPerformanceTakeAudio
}): KeepInstrumentNightTakeInput {
  const boundary = input.boundary
  const summary = input.summary
  return {
    source: 'guitar-night',
    comparisonKey: guitarNightTakeComparisonKey(boundary),
    title: boundary.reference.title,
    audio: input.audio,
    context: {
      kind: 'guitar-night-score-take',
      version: 1,
      songId: boundary.reference.songId,
      trackId: boundary.reference.trackId,
      pieceLabel: boundary.reference.title,
      trackLabel: boundary.reference.trackName,
      range: {
        startBeat: boundary.range.start,
        endBeat: boundary.range.end,
      },
      tempoBpm: boundary.tempoBpm,
      scoreTempoBpm: boundary.scoreTempoBpm,
      inputKind: input.inputKind,
      scoreBasis: summary.basis,
    },
    metrics: {
      score: summary.score,
      grade: summary.grade,
      targetCount: summary.counts.targetCount,
      judgedTargets: summary.counts.judgedTargets,
      hitTargets: summary.counts.hitTargets,
      missedTargets: summary.counts.missedTargets,
      skippedTargets: summary.counts.skippedTargets,
      bestStreak: summary.bestStreak,
      evidenceStatus: summary.evidence.status,
      detectedGapCount: summary.evidence.detectedGapCount,
      basis: summary.basis,
    },
  }
}

export function useGuitarNightTakeCapture(
  dependencies: GuitarNightTakeCaptureDependencies,
) {
  const keepController = usePerformanceTakeKeep()
  const [boundaryId, setBoundaryId] = createSignal<string | null>(null)
  const recorderFactory = dependencies.createRecorder ?? createTakeRecorder
  const inspectTake = dependencies.inspectTake ?? inspectVoiceTake
  const saveTake = dependencies.saveTake ?? keepInstrumentNightTake
  const nowIso = dependencies.nowIso ?? (() => new Date().toISOString())
  const visibilityTarget =
    dependencies.visibilityTarget === undefined
      ? typeof document === 'undefined'
        ? null
        : document
      : dependencies.visibilityTarget

  let active: ActiveCapture | null = null
  let prepared: PreparedCapture | null = null
  let completedSummary: GuitarScoreTakeSummary | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let disposed = false

  const clearTimers = (): void => {
    if (startTimer !== null) clearTimeout(startTimer)
    if (stopTimer !== null) clearTimeout(stopTimer)
    startTimer = null
    stopTimer = null
  }

  const discardActiveRecorder = (): void => {
    clearTimers()
    const current = active
    active = null
    current?.recorder.discard()
    current?.recorder.dispose()
  }

  const publishReady = (): void => {
    const replay = prepared
    const summary = completedSummary
    if (
      replay === null ||
      summary === null ||
      summary.status !== 'completed' ||
      boundaryId() !== replay.boundary.id
    ) {
      return
    }
    const payload = guitarNightTakeKeepInput({
      boundary: replay.boundary,
      inputKind: replay.inputKind,
      summary,
      audio: replay.audio,
    })
    keepController.ready(
      () => saveTake(payload),
      'Guitar replay ready. Nothing is saved until you keep it.',
    )
  }

  const failCurrent = (message: string): void => {
    prepared = null
    completedSummary = null
    keepController.fail(message)
  }

  const invalidateActiveCapture = (message: string): boolean => {
    if (active === null) return false
    generation += 1
    discardActiveRecorder()
    failCurrent(message)
    return true
  }

  const invalidateForTimingDrift = (): boolean =>
    invalidateActiveCapture(
      'Your score is safe, but browser timing moved outside the scored run, so this replay was discarded.',
    )

  const invalidateForVisibilityLoss = (): boolean =>
    invalidateActiveCapture(
      'Your score is safe, but this page left the foreground during capture, so the replay was discarded.',
    )

  const handleVisibilityChange = (): void => {
    if (visibilityTarget?.hidden !== true) return
    invalidateForVisibilityLoss()
  }

  visibilityTarget?.addEventListener('visibilitychange', handleVisibilityChange)

  const finishCapture = (requestedBoundaryId: string): boolean => {
    const current = active
    if (current === null || current.boundary.id !== requestedBoundaryId) {
      return false
    }
    if (visibilityTarget?.hidden === true) {
      return invalidateForVisibilityLoss()
    }
    if (current.startedAtSeconds === null || current.capturedAt === null) {
      generation += 1
      discardActiveRecorder()
      failCurrent(
        'Your score is safe, but this take ended before replay audio began.',
      )
      return true
    }
    const stoppedAtSeconds = current.context.currentTime
    if (
      hasMaterialBoundaryDrift(
        stoppedAtSeconds,
        current.boundary.completedAtSeconds,
      )
    ) {
      return invalidateForTimingDrift()
    }
    const capturedAt = current.capturedAt
    const startedAtSeconds = current.startedAtSeconds

    clearTimers()
    active = null
    const run = ++generation
    const fallbackDurationMs = Math.max(
      0,
      Math.round((stoppedAtSeconds - startedAtSeconds) * 1000),
    )
    keepController.beginProcessing(
      'Preparing your private guitar replay on this device.',
    )

    void (async () => {
      try {
        const blob = await current.recorder.stop()
        current.recorder.dispose()
        if (disposed || run !== generation) return
        if (blob === null || blob.size === 0) {
          failCurrent(
            'Your score is safe, but no replay audio was captured. Check the selected input and try again.',
          )
          return
        }
        const inspection = await inspectTake(
          blob,
          current.context,
          fallbackDurationMs,
        )
        if (disposed || run !== generation) return
        if (inspection.durationMs <= 0) {
          failCurrent(
            'Your score is safe, but the replay could not be prepared in this browser.',
          )
          return
        }
        prepared = {
          boundary: current.boundary,
          inputKind: current.inputKind,
          audio: {
            blob,
            durationMs: inspection.durationMs,
            peaks: inspection.peaks,
            capturedAt,
          },
        }
        publishReady()
      } catch {
        current.recorder.dispose()
        if (disposed || run !== generation) return
        failCurrent(
          'Your score is safe, but the replay could not be prepared in this browser.',
        )
      }
    })()
    return true
  }

  const startRecorder = (requestedBoundaryId: string, run: number): void => {
    startTimer = null
    const current = active
    if (
      disposed ||
      run !== generation ||
      current === null ||
      current.boundary.id !== requestedBoundaryId
    ) {
      return
    }
    if (visibilityTarget?.hidden === true) {
      invalidateForVisibilityLoss()
      return
    }
    if (
      hasMaterialBoundaryDrift(
        current.context.currentTime,
        current.boundary.startedAtSeconds,
      )
    ) {
      invalidateForTimingDrift()
      return
    }
    if (!current.recorder.start()) {
      current.recorder.dispose()
      active = null
      failCurrent('The guitar replay could not start. Your score still works.')
      return
    }
    current.capturedAt = nowIso()
    current.startedAtSeconds = current.context.currentTime
    const delayMs = Math.max(
      0,
      (current.boundary.completedAtSeconds - current.context.currentTime) *
        1000,
    )
    stopTimer = setTimeout(() => finishCapture(current.boundary.id), delayMs)
  }

  const begin = (
    boundary: GuitarNightScoreLiveBoundary,
    inputKind: GuitarInputProfileKind,
  ): boolean => {
    if (disposed || keepController.state() === 'saving') return false
    generation += 1
    discardActiveRecorder()
    prepared = null
    completedSummary = null
    keepController.dismiss()
    setBoundaryId(boundary.id)

    if (inputKind !== 'microphone' && inputKind !== 'interface') {
      keepController.unsupported(
        'Audio replay is available for Room mic or Direct input, not MIDI.',
      )
      return false
    }
    const stream = dependencies.getStream()
    const context = dependencies.getAudioContext()
    if (stream === null || context === null) {
      failCurrent(
        'Your score still works, but this input did not provide replay audio.',
      )
      return false
    }
    const recorder = recorderFactory(stream)
    if (recorder === null) {
      keepController.unsupported(
        'Pitch scoring worked, but this browser cannot prepare an audio replay.',
      )
      return false
    }

    active = {
      boundary,
      inputKind,
      recorder,
      context,
      capturedAt: null,
      startedAtSeconds: null,
    }
    keepController.beginCapture('Capturing this scored guitar performance.')
    if (visibilityTarget?.hidden === true) {
      invalidateForVisibilityLoss()
      return false
    }
    const run = generation
    const delayMs = Math.max(
      0,
      (boundary.startedAtSeconds - context.currentTime) * 1000,
    )
    startTimer = setTimeout(() => startRecorder(boundary.id, run), delayMs)
    return true
  }

  const finish = (requestedBoundaryId: string): boolean =>
    finishCapture(requestedBoundaryId)

  const attachCompletedSummary = (
    requestedBoundaryId: string,
    summary: GuitarScoreTakeSummary,
  ): boolean => {
    if (
      summary.status !== 'completed' ||
      boundaryId() !== requestedBoundaryId
    ) {
      return false
    }
    completedSummary = summary
    publishReady()
    return true
  }

  const discard = (requestedBoundaryId?: string | null): boolean => {
    if (
      requestedBoundaryId !== undefined &&
      requestedBoundaryId !== null &&
      boundaryId() !== requestedBoundaryId
    ) {
      return false
    }
    if (!keepController.dismiss()) return false
    generation += 1
    discardActiveRecorder()
    prepared = null
    completedSummary = null
    setBoundaryId(null)
    return true
  }

  const keep = async (): Promise<boolean> => {
    const kept = await keepController.keep()
    if (kept) {
      prepared = null
      completedSummary = null
    }
    return kept
  }

  onCleanup(() => {
    visibilityTarget?.removeEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )
    disposed = true
    generation += 1
    discardActiveRecorder()
    prepared = null
    completedSummary = null
  })

  return {
    state: keepController.state,
    message: keepController.message,
    boundaryId: boundaryId as Accessor<string | null>,
    begin,
    finish,
    attachCompletedSummary,
    discard,
    keep,
  }
}
