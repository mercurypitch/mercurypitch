// Free-form session joins Live, Replay and Practice without replacing the room's input or stage.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { createRecordingScore, recordingScoreProblem, recordingScoreTuning, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { acceptRecordingPractice } from './accept-recording-practice'
import { recordedScoreSource } from './recorded-score-reference-port'
import type { GuitarNightReference } from './reference-port'
import { openGuitarNightReference } from './reference-port'
import type { GuitarFreeFormMode } from './useGuitarFreeFormModes'
import { useGuitarFreeFormModes } from './useGuitarFreeFormModes'
import { useGuitarFreeFormPractice } from './useGuitarFreeFormPractice'
import type { GuitarListeningController } from './useGuitarListeningController'
import { useGuitarLiveHistoryStage } from './useGuitarLiveHistoryStage'
import { useGuitarNightScoreResults } from './useGuitarNightScoreResults'
import type { GuitarRecordingController } from './useGuitarRecordingController'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'
import type { useGuitarRecordingStage } from './useGuitarRecordingStage'

export function useGuitarFreeFormSession(options: {
  enabled: Accessor<boolean>
  blocked: Accessor<boolean>
  listening: GuitarListeningController
  recorder: GuitarRecordingController
  playback: GuitarRecordingPlayback
  recordingStage: ReturnType<typeof useGuitarRecordingStage>
  tuning: Accessor<InstrumentTuning>
  amp: Accessor<GuitarElectricAmpParameters>
  activateGraph(): Promise<GuitarSessionAudioGraph | null>
  onMissingSource(): void
  /** Durable-store boundary; the production path uses the device's recording store. */
  recordingStore?: ReturnType<typeof createGuitarRecordingStore>
  createPracticeCapture?: Parameters<
    typeof useGuitarFreeFormPractice
  >[0]['createCapture']
  createPracticeBand?: Parameters<
    typeof useGuitarFreeFormPractice
  >[0]['createBand']
}) {
  const [activeMode, setActiveMode] = createSignal<GuitarFreeFormMode>('live')
  const [reference, setReference] = createSignal<GuitarNightReference | null>(
    null,
  )
  const [admissionNotice, setAdmissionNotice] = createSignal<string | null>(
    null,
  )
  const [scoreOpen, setScoreOpen] = createSignal(false)
  const [openingScore, setOpeningScore] = createSignal(false)
  let admissionGeneration = 0
  let disposed = false
  const sessionBlocked = () =>
    !options.enabled() || options.blocked() || scoreOpen() || openingScore()
  const practice = useGuitarFreeFormPractice({
    reference,
    enabled: () => options.enabled() && activeMode() === 'practice',
    // Results park with pause(), never settle(): the held assessment remains
    // partial instead of being promoted to a completed take by opening UI.
    blocked: () =>
      !options.enabled() || options.blocked() || options.recorder.busy(),
    listening: options.listening,
    amp: options.amp,
    activateGraph: options.activateGraph,
    ...(options.createPracticeCapture === undefined
      ? {}
      : { createCapture: options.createPracticeCapture }),
    ...(options.createPracticeBand === undefined
      ? {}
      : { createBand: options.createPracticeBand }),
  })
  // Consent is an admission lock, not a Practice block: confirmMic must still
  // be allowed to finish the explicitly approved start inside that dialog.
  const admissionBlocked = () =>
    sessionBlocked() ||
    practice.consentOpen() ||
    practice.capture.state() === 'saving'
  const results = useGuitarNightScoreResults({
    reference,
    liveScore: practice.liveScore,
    scoreTakeCapture: practice.capture,
  })
  const installScore = (score: GuitarPracticeScore): boolean => {
    const opened = openGuitarNightReference(
      recordedScoreSource(score),
      'melody',
      recordingScoreTuning(score),
    )
    if (!opened.ok) {
      setAdmissionNotice(
        'These notes could not be opened for Practice. Review their fingering first.',
      )
      return false
    }
    if (reference()?.songId !== opened.reference.songId)
      setReference(opened.reference)
    return true
  }
  const preparePractice = async (): Promise<boolean> => {
    const operation = admissionGeneration
    const draft = options.recorder.draft()
    if (draft === null) return false
    const preview = options.recorder.previewScore()
    const corrections =
      preview ??
      draft.editableScore ??
      draft.acceptedScore ??
      createRecordingScore(draft.recording, draft.notes, options.tuning())
    const problem = recordingScoreProblem(corrections)
    if (problem !== null) {
      setAdmissionNotice(problem)
      options.recorder.setReviewOpen(true)
      return false
    }
    const accepted = await acceptRecordingPractice(
      draft,
      corrections,
      options.recordingStore,
    )
    // Keep is atomic once requested, but its late result must not replace an
    // editor or stage whose source, corrections or mode intent has changed.
    if (
      disposed ||
      operation !== admissionGeneration ||
      admissionBlocked() ||
      options.recorder.busy() ||
      options.recorder.draft()?.recording.id !== draft.recording.id ||
      options.recorder.previewScore() !== preview
    )
      return false
    options.recorder.setPreviewScore(accepted)
    void options.recorder.refresh()
    setAdmissionNotice(null)
    return installScore(accepted)
  }
  const modes = useGuitarFreeFormModes({
    sourceId: () => options.recorder.draft()?.recording.id ?? null,
    captureBusy: options.recorder.busy,
    blocked: admissionBlocked,
    pauseReplay: options.playback.pause,
    settlePractice: practice.settle,
    cancelPracticeStart: () => {
      admissionGeneration++
      practice.cancelStart()
    },
    preparePractice,
    startRecording: options.recorder.start,
    onMissingSource: options.onMissingSource,
  })
  createEffect(() => {
    if (sessionBlocked()) untrack(modes.cancel)
  })
  onCleanup(() => {
    disposed = true
    admissionGeneration++
  })
  createEffect(() => setActiveMode(modes.mode()))
  const live = useGuitarLiveHistoryStage({
    listening: options.listening,
    tuning: options.tuning,
    enabled: () =>
      options.enabled() &&
      modes.mode() === 'live' &&
      !options.recorder.busy() &&
      options.recordingStage.showLiveNotes(),
  })
  const currentStage = createMemo(() =>
    options.recorder.busy()
      ? options.recordingStage.source
      : modes.mode() === 'live'
        ? live.source
        : modes.mode() === 'practice'
          ? practice.stage
          : options.recordingStage.source,
  )
  // Forward into one stable stage so source changes never remount its camera/canvas.
  const stage: GuitarPerformanceStageSource = {
    title: () => currentStage().title(),
    notes: () =>
      modes.mode() === 'live' &&
      !options.recorder.busy() &&
      !options.recordingStage.showLiveNotes()
        ? []
        : currentStage().notes(),
    recordingHistory: () => currentStage().recordingHistory?.() ?? false,
    historyKind: () => currentStage().historyKind?.() ?? 'recording',
    timeline: {
      positionSeconds: () => currentStage().timeline.positionSeconds(),
      durationSeconds: () => currentStage().timeline.durationSeconds(),
      playheadBeat: () => currentStage().timeline.playheadBeat(),
      tempoBpm: () => currentStage().timeline.tempoBpm(),
    },
  }
  const playing = () =>
    modes.mode() === 'practice'
      ? practice.running()
      : options.playback.playing()
  const pending = () =>
    modes.pending() !== null ||
    (modes.mode() === 'practice'
      ? practice.pending()
      : options.playback.pending())
  const pause = () => {
    modes.cancel()
    if (modes.mode() === 'practice') void practice.pause()
    else options.playback.pause()
  }
  const play = async () => {
    if (
      disposed ||
      admissionBlocked() ||
      options.recorder.busy() ||
      modes.pending() !== null
    )
      return
    admissionGeneration++
    if (modes.mode() === 'practice') {
      await practice.play()
      return
    }
    if (modes.mode() === 'live') {
      const selecting = modes.select('replay')
      const operation = admissionGeneration
      if (
        !(await selecting) ||
        disposed ||
        operation !== admissionGeneration ||
        admissionBlocked() ||
        options.recorder.busy() ||
        modes.mode() !== 'replay'
      )
        return
    }
    if (!options.playback.playing()) await options.playback.toggle()
  }
  const stop = async (): Promise<void> => {
    modes.cancel()
    const operation = admissionGeneration
    const stoppedReference = reference()
    if (modes.mode() === 'practice') {
      await practice.settle()
      if (
        !disposed &&
        operation === admissionGeneration &&
        modes.mode() === 'practice' &&
        reference() === stoppedReference &&
        !admissionBlocked()
      )
        await practice.seekBeat(0)
    } else options.playback.stop()
  }
  const restart = async (): Promise<void> => {
    if (
      disposed ||
      admissionBlocked() ||
      options.recorder.busy() ||
      modes.pending() !== null
    )
      return
    modes.cancel()
    if (modes.mode() !== 'practice') {
      options.playback.stop()
      await play()
      return
    }
    const operation = admissionGeneration
    const restartingReference = reference()
    await practice.seekBeat(0)
    if (
      disposed ||
      operation !== admissionGeneration ||
      admissionBlocked() ||
      options.recorder.busy() ||
      modes.mode() !== 'practice' ||
      reference() !== restartingReference
    )
      return
    await practice.play()
  }
  const recover = async (id: string, review = true) => {
    if (disposed || practice.capture.state() === 'saving') return
    modes.cancel()
    const operation = admissionGeneration
    await modes.park()
    if (
      disposed ||
      operation !== admissionGeneration ||
      practice.capture.state() === 'saving'
    )
      return
    await options.recorder.recover(id, { review })
  }
  const remove = async (id: string) => {
    if (disposed) return
    if (practice.capture.state() === 'saving')
      throw new Error('Finish keeping this take before removing a melody.')
    if (options.recorder.draft()?.recording.id === id) {
      modes.cancel()
      const operation = admissionGeneration
      await modes.park()
      if (disposed || operation !== admissionGeneration) return
      if (practice.capture.state() === 'saving')
        throw new Error('Finish keeping this take before removing a melody.')
    }
    return options.recorder.remove(id)
  }
  const reviewPractice = async (score: GuitarPracticeScore) => {
    options.recorder.setPreviewScore(score)
    options.recorder.setReviewOpen(false)
    await modes.select('practice', { refresh: true })
  }
  const openScore = async () => {
    if (
      disposed ||
      admissionBlocked() ||
      options.recorder.busy() ||
      modes.mode() !== 'practice'
    )
      return
    modes.cancel()
    // Reserve the dialog before draining; a Play between these awaits must
    // not begin an invisible take underneath the results that are opening.
    setOpeningScore(true)
    const operation = admissionGeneration
    const openingReference = reference()
    try {
      await practice.pause()
      if (
        !disposed &&
        operation === admissionGeneration &&
        options.enabled() &&
        !options.blocked() &&
        modes.mode() === 'practice' &&
        reference() === openingReference
      )
        setScoreOpen(true)
    } finally {
      if (!disposed) setOpeningScore(false)
    }
  }
  const playAgain = async (): Promise<void> => {
    const replay = results.scoreReplay()
    const replayBoundary = practice.liveScore.boundary()
    if (
      disposed ||
      !options.enabled() ||
      options.blocked() ||
      options.recorder.busy() ||
      practice.capture.state() === 'saving' ||
      practice.consentOpen() ||
      modes.pending() !== null ||
      modes.mode() !== 'practice' ||
      replay === null ||
      replayBoundary === null
    )
      return
    modes.cancel()
    setScoreOpen(false)
    const operation = admissionGeneration
    const replayReference = reference()
    const sourceId = options.recorder.draft()?.recording.id
    await practice.settle()
    // Finalizing a partial summary intentionally replaces the summary object.
    // The immutable boundary and source, not that object, own this repeat.
    if (
      disposed ||
      operation !== admissionGeneration ||
      admissionBlocked() ||
      options.recorder.busy() ||
      modes.mode() !== 'practice' ||
      reference() !== replayReference ||
      options.recorder.draft()?.recording.id !== sourceId ||
      practice.liveScore.boundary()?.id !== replayBoundary.id
    )
      return
    await practice.play(replay.range)
  }
  return {
    modes,
    practice,
    results,
    reference,
    live,
    stage,
    scoreOpen,
    setScoreOpen,
    openScore,
    playAgain,
    notice: () => admissionNotice() ?? modes.error() ?? practice.notice(),
    tuning: () =>
      modes.mode() === 'live' && !options.recorder.busy()
        ? options.tuning()
        : modes.mode() === 'practice'
          ? ((practice.room.displayReference() ?? reference())?.tuning ??
            options.tuning())
          : options.recordingStage.tuning(),
    recorder: { ...options.recorder, start: modes.record },
    recover,
    remove,
    reviewPractice,
    playing,
    pending,
    play,
    pause,
    stop,
    restart,
    toggle: () => (playing() || pending() ? pause() : void play()),
    position: () =>
      modes.mode() === 'practice'
        ? practice.room.displayPositionSeconds()
        : options.playback.position(),
    duration: () =>
      modes.mode() === 'practice'
        ? practice.room.durationSeconds()
        : options.playback.duration(),
    seek: (seconds: number) => {
      if (disposed || admissionBlocked() || options.recorder.busy()) return
      admissionGeneration++
      if (modes.mode() === 'practice') practice.seekSeconds(seconds)
      else options.playback.seek(seconds)
    },
    showHistory: async () => {
      if (await modes.select('replay')) options.playback.showHistory()
    },
  }
}
