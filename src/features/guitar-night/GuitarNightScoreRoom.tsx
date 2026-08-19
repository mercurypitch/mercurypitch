// The score room rehearses an imported tab alone — no recording, no backing stems.
// ============================================================
//
// A tab is a complete rehearsal on its own terms: count-in, click, and the same
// stage the play-along room uses. Explicit Listening may add a compact,
// evidence-bounded live score; phrase diagnosis remains a separate Review.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { ChevronLeft, Ear, Mic, MusicNote, Pause, Play, RotateCcw, SlidersHorizontal, Volume2, } from '@/components/icons'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { compareGuitarDoctorWithHistory, loadGuitarDoctorHistory, saveGuitarDoctorHistory, } from '@/lib/guitar/guitar-doctor-history'
import { createGuitarPhraseAssessmentWindow, reviewGuitarPhrase, } from '@/lib/guitar/guitar-phrase-review'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { guitarPhraseDoctorView, retainedTakeHealth, } from './guitar-phrase-doctor-view'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightInputHealth } from './GuitarNightInputHealth'
import { GuitarNightInputNotice } from './GuitarNightInputNotice'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'
import { GuitarNightDoctorCue, GuitarNightJamDoctor, } from './GuitarNightJamDoctor'
import { GuitarNightLiveScore } from './GuitarNightLiveScore'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import { GuitarNightSessionPanel } from './GuitarNightSessionPanel'
import { GuitarNightStage } from './GuitarNightStage'
import { GuitarNightTunerExperience } from './GuitarNightTunerExperience'
import type { GuitarNightReference } from './reference-port'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightLiveScoreController } from './useGuitarNightLiveScoreController'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import type { GuitarNightScoreAssessmentBoundary } from './useGuitarNightScoreRoomController'
import { SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'
import { useGuitarNightTunerController } from './useGuitarNightTunerController'

interface GuitarNightScoreRoomProps {
  reference: Accessor<GuitarNightReference>
  /** The instrument the stage rows describe. */
  tuning?: Accessor<InstrumentTuning>
  onInstrument?(instrument: StringedInstrument): void
  onStringCount?(count: number): void
  onTuning?(tuning: InstrumentTuning): void
  /** A room-level sheet parks every side effect while preserving room state. */
  suspended?: Accessor<boolean>
  onSongs(): void
  /**
   * Read a different part of the loaded file without leaving the room. Absent
   * keeps the session panel read-only, which is what a single-part file wants.
   */
  onSelectTrack?(trackId: string): void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

/** Beats are counted from one on screen, the way a player counts them. */
function formatBeat(beat: number): string {
  const countedBeat = Math.max(0, beat) + 1
  const label = Number.isInteger(countedBeat)
    ? String(countedBeat)
    : countedBeat.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `beat ${label}`
}

function compactBeatLength(beats: number): string {
  const value = Number.isInteger(beats)
    ? String(beats)
    : beats.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${value} ${beats === 1 ? 'beat' : 'beats'}`
}

const COUNT_IN_CHOICES = [0, 2, 4, 8]

/** Whether the marks on screen differ from the loop already in the scheduler. */
export function scoreLoopPendingRestart(
  marked: LoopSpan | null,
  running: LoopSpan | null,
  takeActive: boolean,
): boolean {
  if (!takeActive) return false
  const scheduledMarks = marked === null ? null : quantizeSpanToBeats(marked)
  if (running === null) return scheduledMarks !== null
  if (scheduledMarks === null) return true
  return (
    running.start !== scheduledMarks.start || running.end !== scheduledMarks.end
  )
}

/** Pick a named, bounded phrase without pretending the score has sections. */
export function scoreAssessmentRange(
  marked: LoopSpan | null,
  playheadBeat: number | null,
  durationBeats: number,
  noteStarts: readonly number[],
): LoopSpan | null {
  if (!(durationBeats > 0)) return null
  if (marked !== null) {
    const quantized = quantizeSpanToBeats(marked)
    return normalizeLoopSpan(quantized.start, quantized.end, durationBeats)
  }

  const parked = Math.min(durationBeats, Math.max(0, playheadBeat ?? 0))
  const nextNote = [...noteStarts]
    .filter((beat) => Number.isFinite(beat) && beat >= parked)
    .sort((left, right) => left - right)[0]
  let start = Math.floor(nextNote ?? parked)
  let end = Math.min(durationBeats, start + 4)
  const intendedLength = Math.min(4, durationBeats)
  if (end - start < intendedLength) {
    end = durationBeats
    start = Math.max(0, end - intendedLength)
  }
  return normalizeLoopSpan(start, end, durationBeats)
}

/** One continuous scored pass: the marked loop, or here through score end. */
export function scoreLiveRange(
  marked: LoopSpan | null,
  playheadBeat: number | null,
  durationBeats: number,
  noteStarts: readonly number[] = [],
): LoopSpan | null {
  if (!(durationBeats > 0)) return null
  if (marked !== null) {
    const quantized = quantizeSpanToBeats(marked)
    return normalizeLoopSpan(quantized.start, quantized.end, durationBeats)
  }
  const parked = Math.min(durationBeats, Math.max(0, playheadBeat ?? 0))
  const hasUpcomingTarget = noteStarts.some(
    (beat) => Number.isFinite(beat) && beat >= parked && beat < durationBeats,
  )
  const start =
    parked >= durationBeats || (noteStarts.length > 0 && !hasUpcomingTarget)
      ? 0
      : parked
  return normalizeLoopSpan(start, durationBeats, durationBeats)
}

export function GuitarNightScoreRoom(props: GuitarNightScoreRoomProps) {
  let roomHeading!: HTMLHeadingElement
  let sessionDetails!: HTMLDetailsElement
  let sessionSummary!: HTMLElement
  let doctorTrigger: HTMLButtonElement | undefined
  let tunerTrigger: HTMLButtonElement | undefined
  let disposed = false
  const [sessionPanelOpen, setSessionPanelOpen] = createSignal(false)
  const [doctorOpen, setDoctorOpen] = createSignal(false)
  const [tunerOpen, setTunerOpen] = createSignal(false)
  const [doctorRecoveryActive, setDoctorRecoveryActive] = createSignal(false)
  const [assessmentPending, setAssessmentPending] = createSignal(false)
  const [assessmentComparison, setAssessmentComparison] = createSignal<string>()
  const [assessmentBoundary, setAssessmentBoundary] =
    createSignal<GuitarNightScoreAssessmentBoundary | null>(null)
  const [assessmentWindow, setAssessmentWindow] = createSignal<ReturnType<
    typeof createGuitarPhraseAssessmentWindow
  > | null>(null)
  // The tab room counts in beats, not seconds: a tempo change should move the
  // same bars, not a different span of the score.
  const scoreBeats = createMemo(() =>
    props
      .reference()
      .notes.reduce(
        (latest, note) => Math.max(latest, note.startBeat + note.duration),
        0,
      ),
  )
  const loop = useGuitarNightLoopController({ limit: scoreBeats })
  const room = useGuitarNightScoreRoomController({
    reference: () => props.reference(),
    loop: loop.span,
    instrument: () => props.tuning?.().instrument ?? 'guitar',
  })
  const displayedReference = createMemo(
    () => room.displayReference() ?? props.reference(),
  )
  const listening = useGuitarListeningController({
    activateAudio: room.activateAudio,
    getAudioGraph: room.getAudioGraph,
  })
  const selectedLiveScoreRange = createMemo(() =>
    scoreLiveRange(
      loop.span(),
      room.playheadBeat(),
      scoreBeats(),
      props.reference().notes.map((note) => note.startBeat),
    ),
  )
  const liveScore = useGuitarNightLiveScoreController({
    listeningStatus: listening.status,
    inputKind: listening.inputProfile,
    take: listening.take,
    health: listening.health,
    roomStatus: room.status,
    countInRemaining: room.countInRemaining,
    playheadBeat: room.playheadBeat,
    startRoom: room.startLiveScore,
    stopRoom: room.stop,
    pauseRoom: room.pause,
    stopInput: listening.stop,
    armTakeAt: listening.armTakeAt,
    completeTakeAt: listening.completeTakeAt,
  })
  const tunerTuning = createMemo(
    () => props.tuning?.() ?? displayedReference().tuning,
  )
  const tuner = useGuitarNightTunerController({
    tuning: tunerTuning,
    listening,
    activateAudio: room.activateAudio,
    getAudioGraph: room.getAudioGraph,
    pausePlayback: room.pause,
    onTuning: (next) => props.onTuning?.(next),
  })
  const selectedAssessmentRange = createMemo(() =>
    scoreAssessmentRange(
      loop.span(),
      room.playheadBeat(),
      scoreBeats(),
      props.reference().notes.map((note) => note.startBeat),
    ),
  )
  const phraseReview = createMemo(() => {
    const window = assessmentWindow()
    const take = listening.take()
    if (
      window === null ||
      take?.lifecycle !== 'completed' ||
      take.id !== window.takeId
    ) {
      return null
    }
    return reviewGuitarPhrase({
      window,
      take,
      inputHealth: retainedTakeHealth(take),
    })
  })
  const doctorView = createMemo(() => {
    const review = phraseReview()
    const boundary = assessmentBoundary()
    if (review === null || boundary === null) return null
    return guitarPhraseDoctorView(
      review,
      boundary.tempoBpm,
      assessmentComparison(),
    )
  })
  const isRunning = createMemo(
    () => room.status() === 'count-in' || room.status() === 'playing',
  )
  const takeIsActive = createMemo(() => room.setupLocked())
  const assessmentCaptureActive = createMemo(() => {
    const window = assessmentWindow()
    const take = listening.take()
    return (
      window !== null &&
      take?.lifecycle === 'recording' &&
      take.id === window.takeId
    )
  })
  const scoredCaptureActive = createMemo(() => liveScore.captureActive())
  let savedReviewTakeId: string | null = null
  createEffect(() => {
    const review = phraseReview()
    const boundary = assessmentBoundary()
    const take = listening.take()
    const window = assessmentWindow()
    if (
      review === null ||
      boundary === null ||
      take === null ||
      window === null ||
      savedReviewTakeId === review.takeId
    ) {
      return
    }
    savedReviewTakeId = review.takeId
    try {
      const storage = globalThis.localStorage
      const history = loadGuitarDoctorHistory(storage)
      const summary = saveGuitarDoctorHistory(storage, review, {
        tempoBpm: boundary.tempoBpm,
        playbackRate: 1,
        completed:
          take.lifecycle === 'completed' &&
          (take.durationFrames ?? 0) >= window.durationFrames,
        nonTruncated: !take.truncated,
        sampleRate: take.clock.sampleRate,
        attackPrecision: take.clock.attack.precision,
        latencyProvenance: take.clock.latency.provenance,
      })
      setAssessmentComparison(
        summary === null
          ? undefined
          : (compareGuitarDoctorWithHistory(history, summary) ?? undefined),
      )
    } catch {
      setAssessmentComparison(undefined)
    }
  })
  // A loop is scheduled into the click at start, so marks moved mid-take take
  // effect on the next one. Say so rather than looking ignored.
  const loopPendingRestart = createMemo(() =>
    scoreLoopPendingRestart(loop.span(), room.runningLoop(), takeIsActive()),
  )
  const isCalibrating = createMemo(() => listening.status() === 'calibrating')
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' ||
      listening.status() === 'requesting' ||
      isCalibrating(),
  )
  const playbackLabel = createMemo(() => {
    if (room.status() === 'starting') return 'Opening the room clock'
    if (isRunning()) return 'Pause score'
    if (room.status() === 'paused') {
      if (loopPendingRestart()) return 'Start updated loop'
      return room.setupLocked() ? 'Resume score' : 'Start from here'
    }
    if (room.status() === 'complete') {
      return loop.span() === null ? 'Replay score' : 'Rehearse loop'
    }
    return 'Start the count-in'
  })
  const assessmentActionLabel = createMemo(() => {
    const range = selectedAssessmentRange()
    if (assessmentPending()) return 'Opening the phrase review'
    if (range === null) return 'No phrase available to review'
    const length = range.end - range.start
    return `Review ${formatBeat(range.start)} for ${compactBeatLength(length)}`
  })
  let scrubbing = false
  let resumeAfterScrub = false
  let keyboardScrubbing = false

  const stage: GuitarPerformanceStageSource = {
    title: () => displayedReference().title,
    notes: () => displayedReference().notes,
    timeline: {
      positionSeconds: room.displayPositionSeconds,
      durationSeconds: room.durationSeconds,
      playheadBeat: room.playheadBeat,
      tempoBpm: room.tempoBpm,
    },
  }

  const beginAssessment = async (
    requestedRange: LoopSpan | null = selectedAssessmentRange(),
  ): Promise<boolean> => {
    const range = requestedRange
    if (range === null || assessmentPending() || isCalibrating()) return false

    setAssessmentPending(true)
    liveScore.clear()
    setDoctorOpen(false)
    sessionDetails.open = false
    try {
      const inputReady =
        listening.status() === 'listening' || (await listening.start())
      if (!inputReady || disposed) return false

      const boundary = await room.startAssessment(range)
      if (boundary === null || disposed) {
        listening.cancel()
        return false
      }
      if (!listening.armTakeAt(boundary.startedAtSeconds)) {
        room.stop()
        listening.cancel()
        return false
      }
      const take = listening.take()
      if (take === null) {
        room.stop()
        listening.cancel()
        return false
      }
      const window = createGuitarPhraseAssessmentWindow({
        id: boundary.id,
        takeId: take.id,
        referenceId: boundary.reference.songId,
        trackId: boundary.reference.trackId,
        range: {
          startBeat: boundary.range.start,
          endBeat: boundary.range.end,
        },
        startedAtSeconds: boundary.startedAtSeconds,
        sampleRate: boundary.sampleRate,
        beatToSeconds: boundary.beatToSeconds,
        targets: boundary.reference.notes.map((note) => ({
          id: note.id,
          midi: note.midi,
          startBeat: note.startBeat,
        })),
      })
      if (!listening.completeTakeAt(boundary.completedAtSeconds)) {
        room.stop()
        listening.cancel()
        return false
      }
      setAssessmentComparison(undefined)
      setAssessmentBoundary(boundary)
      setAssessmentWindow(window)
      return true
    } finally {
      if (!disposed) setAssessmentPending(false)
    }
  }

  const finishAssessmentEarly = (): boolean => {
    if (!assessmentCaptureActive()) return false
    listening.stop()
    return true
  }

  const toggleListening = (): void => {
    if (isListening()) {
      const scoring = scoredCaptureActive()
      if (scoring) liveScore.hold()
      if (assessmentCaptureActive() || scoring) room.pause()
      listening.stop()
      return
    }
    // The score voice is pitched audio. Letting the microphone listen to it
    // would make the room appear to hear the player when it heard itself.
    if (takeIsActive() || room.status() === 'complete') room.stop()
    liveScore.clear()
    void listening.start()
  }

  const togglePlayback = (): void => {
    if (isCalibrating()) return
    if (assessmentCaptureActive()) {
      const transportWasActive =
        room.status() === 'starting' ||
        room.status() === 'count-in' ||
        room.status() === 'playing'
      listening.stop()
      if (transportWasActive) {
        room.pause()
        return
      }
    }
    if (scoredCaptureActive()) {
      const transportWasActive =
        room.status() === 'starting' ||
        room.status() === 'count-in' ||
        room.status() === 'playing'
      liveScore.hold()
      listening.stop()
      if (transportWasActive) room.pause()
      return
    }
    if (room.status() === 'paused' && loopPendingRestart()) {
      const range = selectedLiveScoreRange()
      sessionDetails.open = false
      room.stop()
      if (listening.status() === 'listening' && range !== null) {
        setDoctorOpen(false)
        void liveScore.start(range)
        return
      }
      if (isListening()) listening.stop()
      liveScore.clear()
      void room.start()
      return
    }
    if (!takeIsActive()) {
      sessionDetails.open = false
      const range = selectedLiveScoreRange()
      if (listening.status() === 'listening' && range !== null) {
        setDoctorOpen(false)
        void liveScore.start(range)
        return
      }
      if (isListening()) listening.stop()
      liveScore.clear()
    }
    room.toggle()
  }

  const beginScrub = (): void => {
    if (scrubbing) return
    scrubbing = true
    const reviewing = assessmentCaptureActive() || scoredCaptureActive()
    resumeAfterScrub =
      !reviewing &&
      (room.status() === 'starting' ||
        room.status() === 'count-in' ||
        room.status() === 'playing')
    if (assessmentCaptureActive()) finishAssessmentEarly()
    if (scoredCaptureActive()) {
      liveScore.hold()
      listening.stop()
    }
    room.pause()
  }

  const recoverFromDoctor = async (): Promise<void> => {
    const review = phraseReview()
    const boundary = assessmentBoundary()
    if (review === null) return
    setDoctorRecoveryActive(true)
    setDoctorOpen(false)

    try {
      let range: LoopSpan = {
        start: review.recovery.range.startBeat,
        end: review.recovery.range.endBeat,
      }
      if (review.recovery.kind === 'choose-range') {
        range =
          scoreAssessmentRange(
            null,
            review.range.endBeat,
            scoreBeats(),
            props.reference().notes.map((note) => note.startBeat),
          ) ?? range
      }
      loop.setSpan(range)

      room.setCountInBeats(
        review.recovery.kind === 'replay'
          ? review.recovery.countInBeats
          : (boundary?.countInBeats ?? room.countInBeats()),
      )
      if (review.recovery.kind === 'slow-down') {
        room.setTempoBpm(
          (boundary?.tempoBpm ?? room.tempoBpm()) * review.recovery.tempoScale,
        )
      }
      if (review.recovery.kind === 'calibrate') {
        const opened =
          listening.status() === 'listening' || (await listening.start())
        if (!opened || disposed) {
          if (!disposed) setDoctorOpen(true)
          return
        }
        if (!(await listening.calibrate())) {
          listening.cancel({ preserveNotice: true })
          if (!disposed) setDoctorOpen(true)
          return
        }
      }
      await beginAssessment(range)
    } finally {
      if (!disposed) setDoctorRecoveryActive(false)
    }
  }

  const clearReview = (): void => {
    listening.clearTake()
    setAssessmentWindow(null)
    setAssessmentBoundary(null)
    setAssessmentComparison(undefined)
    setDoctorOpen(false)
  }

  const openTuner = (): void => {
    if (
      assessmentPending() ||
      liveScore.starting() ||
      assessmentCaptureActive() ||
      scoredCaptureActive()
    ) {
      return
    }
    setDoctorOpen(false)
    setTunerOpen(true)
  }

  const closeTuner = (): void => {
    setTunerOpen(false)
    queueMicrotask(() => tunerTrigger?.focus())
  }

  const previewScrub = (event: InputEvent): void => {
    beginScrub()
    room.seekSeconds(Number((event.currentTarget as HTMLInputElement).value))
  }

  const finishScrub = (): void => {
    if (!scrubbing) return
    const shouldResume = resumeAfterScrub
    scrubbing = false
    resumeAfterScrub = false
    if (shouldResume) void room.start()
  }

  const isSeekKey = (key: string): boolean =>
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown'

  const beginKeyboardScrub = (event: KeyboardEvent): void => {
    if (!isSeekKey(event.key)) return
    keyboardScrubbing = true
    beginScrub()
  }

  const finishKeyboardScrub = (event: KeyboardEvent): void => {
    if (!isSeekKey(event.key)) return
    keyboardScrubbing = false
    finishScrub()
  }

  const changeInstrument = (instrument: StringedInstrument): void => {
    if (takeIsActive()) return
    if (room.status() === 'complete') room.stop()
    props.onInstrument?.(instrument)
  }

  const changeStringCount = (count: number): void => {
    if (takeIsActive()) return
    if (room.status() === 'complete') room.stop()
    props.onStringCount?.(count)
  }

  const leaveRoom = (): void => {
    tuner.close()
    liveScore.clear()
    listening.stop()
    room.stop()
    props.onSongs()
  }

  createEffect(() => {
    if (props.suspended?.() !== true) return
    setDoctorOpen(false)
    setDoctorRecoveryActive(false)
    setTunerOpen(false)
    tuner.close()
    if (scoredCaptureActive()) liveScore.hold()
    listening.stop()
    room.pause()
  })

  onCleanup(() => {
    disposed = true
  })

  onMount(() => {
    roomHeading.focus({ preventScroll: true })
    onCleanup(
      installSpacePlaybackToggle({
        toggle: togglePlayback,
        ownsSpace: () =>
          props.suspended?.() !== true && !doctorOpen() && !tunerOpen(),
        enabled: () => room.status() !== 'starting' && !isCalibrating(),
      }),
    )
  })

  return (
    <section
      class={styles.roomPanel}
      data-testid="guitar-night-score-room"
      data-stage-scope="true"
      data-room-kind="score"
    >
      <div class={styles.panelEdge} aria-hidden="true" />
      <div class={styles.roomHeadingRow}>
        <div class={styles.roomIdentity}>
          <button
            type="button"
            class={styles.roomBack}
            aria-label="Back to Songs"
            onClick={leaveRoom}
          >
            <span aria-hidden="true">
              <ChevronLeft />
            </span>
          </button>
          <button
            type="button"
            class={styles.roomIdentityTrigger}
            aria-haspopup="dialog"
            aria-expanded={sessionPanelOpen()}
            data-testid="guitar-night-session-trigger"
            onClick={() => setSessionPanelOpen(true)}
          >
            <p class={styles.eyebrow}>
              Tab rehearsal ·{' '}
              {displayedReference().tracks.length > 1
                ? displayedReference().trackName
                : 'this device'}
            </p>
            <h1
              ref={roomHeading}
              tabindex="-1"
              title={displayedReference().title}
            >
              {displayedReference().title}
            </h1>
          </button>
        </div>
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {displayedReference().notes.length} notes ·{' '}
            {Math.round(room.durationBeats())} beats
          </span>
          <div class={styles.roomTools} aria-label="Room tools">
            <button
              ref={tunerTrigger}
              type="button"
              aria-haspopup="dialog"
              aria-label="Tune guitar"
              disabled={
                assessmentPending() ||
                liveScore.starting() ||
                assessmentCaptureActive() ||
                scoredCaptureActive()
              }
              onClick={openTuner}
            >
              <span aria-hidden="true">
                <MusicNote />
              </span>
              <strong>Tune</strong>
            </button>
            <details
              ref={sessionDetails}
              class={styles.scoreSession}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.open = false
                queueMicrotask(() => sessionSummary.focus())
              }}
            >
              <summary
                ref={sessionSummary}
                aria-label={`${isCalibrating() ? 'Calibrating input' : isListening() ? 'Listening is on' : 'Session controls'}`}
              >
                <span aria-hidden="true">
                  <SlidersHorizontal />
                </span>
                <strong>
                  {isCalibrating()
                    ? 'Calibrating'
                    : isListening()
                      ? 'Listening'
                      : 'Session'}
                </strong>
              </summary>
              <div class={styles.scoreSessionPanel}>
                <header>
                  <div>
                    <strong>Session</strong>
                    <small>
                      {takeIsActive()
                        ? 'Sound settings are held until this take stops.'
                        : 'Set up the next count-in.'}
                    </small>
                  </div>
                </header>

                <GuitarNightInputPicker
                  profile={listening.inputProfile}
                  profileLabel={listening.inputProfileLabel}
                  audioInputs={listening.audioInputs}
                  selectedAudioInputId={listening.selectedAudioInputId}
                  midiInputs={listening.midiInputs}
                  selectedMidiInputId={listening.selectedMidiInputId}
                  midiStatus={listening.midiConnectionStatus}
                  evidenceExportEnabled={listening.evidenceExportEnabled}
                  canExportEvidence={listening.canExportEvidence}
                  switching={() =>
                    takeIsActive() ||
                    listening.status() === 'requesting' ||
                    listening.status() === 'calibrating' ||
                    listening.inputTakeoverPending() ||
                    listening.midiConnectionStatus() === 'requesting'
                  }
                  onProfile={(kind) => void listening.selectInputProfile(kind)}
                  onAudioInput={(deviceId) =>
                    void listening.selectAudioInput(deviceId)
                  }
                  onMidiInput={(deviceId) =>
                    void listening.selectMidiInput(deviceId)
                  }
                  onRefreshAudio={() => void listening.refreshAudioInputs()}
                  onRefreshMidi={() => void listening.refreshMidiInputs()}
                  onExportEvidence={listening.exportEvidenceReport}
                />
                <GuitarNightInputNotice message={listening.notice} />

                <button
                  type="button"
                  class={styles.sessionListening}
                  classList={{ [styles.listeningActive]: isListening() }}
                  aria-pressed={isListening()}
                  disabled={takeIsActive()}
                  aria-label={
                    listening.status() === 'requesting'
                      ? 'Cancel opening input'
                      : isCalibrating()
                        ? 'Stop calibration'
                        : isListening()
                          ? 'Stop Listening'
                          : 'Turn on Listening'
                  }
                  onClick={toggleListening}
                >
                  <span aria-hidden="true">
                    <Mic />
                  </span>
                  <span>
                    <strong>
                      {listening.status() === 'requesting'
                        ? 'Opening input'
                        : isCalibrating()
                          ? 'Calibrating'
                          : isListening()
                            ? 'Listening is on'
                            : 'Turn on Listening'}
                    </strong>
                    <small>Hear notes and enable a live score.</small>
                  </span>
                </button>

                <Show
                  when={
                    listening.status() !== 'off' && listening.error() === null
                  }
                >
                  <GuitarNightInputHealth
                    profile={listening.inputProfile}
                    listening={isListening}
                    calibrating={() => listening.status() === 'calibrating'}
                    health={listening.health}
                    timingSource={listening.timingSource}
                    latencyMs={listening.latencyMs}
                    locked={takeIsActive}
                    onCalibrate={() => void listening.calibrate()}
                  />
                </Show>

                <button
                  type="button"
                  class={styles.scoreAssessmentAction}
                  aria-label={assessmentActionLabel()}
                  disabled={
                    selectedAssessmentRange() === null ||
                    assessmentPending() ||
                    takeIsActive() ||
                    isCalibrating() ||
                    listening.status() === 'requesting'
                  }
                  onClick={() => void beginAssessment()}
                >
                  <span aria-hidden="true">
                    <Ear />
                  </span>
                  <span>
                    <strong>{assessmentActionLabel()}</strong>
                    <small>
                      {loop.span() === null
                        ? 'Count in, then play the next written range without the guide.'
                        : 'Count in, then play your A/B range once without the guide.'}
                    </small>
                  </span>
                </button>

                <div class={styles.scoreSessionSettings}>
                  <label class={styles.countInSelect}>
                    <span aria-hidden="true">
                      <Ear />
                    </span>
                    <strong>Count-in</strong>
                    <select
                      aria-label="Count-in beats"
                      value={room.countInBeats()}
                      disabled={takeIsActive()}
                      onChange={(event) =>
                        room.setCountInBeats(Number(event.currentTarget.value))
                      }
                    >
                      <For each={COUNT_IN_CHOICES}>
                        {(beats) => (
                          <option value={beats}>
                            {beats === 0 ? 'None' : `${beats} beats`}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                  <button
                    type="button"
                    class={styles.hearScoreToggle}
                    aria-pressed={room.hearScore()}
                    disabled={takeIsActive()}
                    classList={{ [styles.hearScoreActive]: room.hearScore() }}
                    onClick={() => room.setHearScore((hearing) => !hearing)}
                  >
                    <span aria-hidden="true">
                      <Volume2 />
                    </span>
                    <span>
                      <strong>
                        {room.hearScore() ? 'Tab sounds' : 'Tab silent'}
                      </strong>
                      <small>
                        {room.hearScore()
                          ? 'Hear the written part.'
                          : 'Click only.'}
                      </small>
                    </span>
                  </button>
                </div>

                <div class={styles.scoreSessionLoop}>
                  <div>
                    <strong>Loop a phrase</strong>
                    <small>
                      Mark A and B at the playhead. Whole beats keep the click
                      steady.
                    </small>
                  </div>
                  <GuitarNightLoopControls
                    span={loop.span()}
                    pending={loop.isPending()}
                    hasStart={loop.markA() !== null}
                    hasEnd={loop.markB() !== null}
                    format={formatBeat}
                    onMarkStart={() => loop.markStart(room.playheadBeat() ?? 0)}
                    onMarkEnd={() =>
                      loop.markEnd(room.playheadBeat() ?? scoreBeats())
                    }
                    onClear={loop.clear}
                  />
                  <Show when={loopPendingRestart()}>
                    <small class={styles.scoreSessionNotice} role="status">
                      Loop changes begin on the next count-in.
                    </small>
                  </Show>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={stage}
        tuning={() => displayedReference().tuning}
        onInstrument={
          props.onInstrument === undefined ? undefined : changeInstrument
        }
        onStringCount={
          props.onStringCount === undefined ? undefined : changeStringCount
        }
        instrumentSetupDisabled={takeIsActive}
        guideLabel={() =>
          displayedReference().tracks.length > 1
            ? `${displayedReference().title} · ${displayedReference().trackName}`
            : displayedReference().title
        }
        active={() => true}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
        signalAccessory={
          <Show when={liveScore.visible()}>
            <GuitarNightLiveScore
              state={liveScore.state}
              basis={liveScore.basis}
              label={liveScore.label}
              detail={liveScore.detail}
              score={liveScore.score}
              grade={liveScore.grade}
              announcement={liveScore.announcement}
            />
          </Show>
        }
        overlay={
          <>
            <Show
              when={
                !doctorOpen() &&
                !liveScore.starting() &&
                !scoredCaptureActive() &&
                doctorView()
              }
            >
              {(view) => (
                <GuitarNightDoctorCue
                  view={view()}
                  expanded={false}
                  controlsId="guitar-night-score-doctor"
                  buttonRef={(element) => {
                    doctorTrigger = element
                  }}
                  onOpen={() => {
                    setDoctorRecoveryActive(false)
                    setDoctorOpen(true)
                  }}
                />
              )}
            </Show>
            <GuitarNightJamDoctor
              id="guitar-night-score-doctor"
              open={doctorOpen()}
              view={doctorView()}
              recording={assessmentCaptureActive()}
              liveEventCount={listening.events().length}
              footer={<GuitarNightInputNotice message={listening.notice} />}
              returnFocus={() =>
                doctorRecoveryActive() ? roomHeading : (doctorTrigger ?? null)
              }
              fallbackFocus={() => roomHeading}
              onClose={() => {
                setDoctorRecoveryActive(false)
                setDoctorOpen(false)
              }}
              onClear={clearReview}
              onRecover={() => void recoverFromDoctor()}
            />
          </>
        }
      />

      <GuitarNightInputError
        message={listening.error}
        canTakeOver={listening.canTakeOverInput}
        takeoverPending={listening.inputTakeoverPending}
        onTakeOver={() => void listening.useInputHere()}
      />
      <Show when={room.error()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <Show when={sessionPanelOpen()}>
        <GuitarNightSessionPanel
          reference={displayedReference}
          onSelectTrack={(trackId) => {
            props.onSelectTrack?.(trackId)
            setSessionPanelOpen(false)
          }}
          onClose={() => {
            setSessionPanelOpen(false)
            queueMicrotask(() =>
              document
                .querySelector<HTMLButtonElement>(
                  '[data-testid="guitar-night-session-trigger"]',
                )
                ?.focus(),
            )
          }}
        />
      </Show>

      <div class={styles.transportDeck} data-testid="guitar-night-score-deck">
        <div class={styles.transportIdentity}>
          <span>
            {assessmentCaptureActive()
              ? 'Phrase review · count-in audible, rehearsal range silent'
              : scoredCaptureActive() || liveScore.starting()
                ? listening.inputProfile() === 'midi'
                  ? 'Live score · MIDI guide follows the authored notes'
                  : 'Live score · count-in audible, scored range silent'
                : loopPendingRestart()
                  ? 'Session changes are ready for the next count-in.'
                  : 'Authored score clock · no recording attached'}
          </span>
        </div>
        <div class={styles.timeRail}>
          <output aria-label="Elapsed score time">
            {formatTime(room.displayPositionSeconds())}
          </output>
          <input
            type="range"
            min="0"
            max={room.durationSeconds() > 0 ? room.durationSeconds() : 1}
            step={Math.max(0.05, 15 / room.tempoBpm())}
            value={room.displayPositionSeconds()}
            aria-label="Score position"
            aria-valuetext={`${formatTime(room.displayPositionSeconds())} of ${formatTime(room.durationSeconds())} · ${formatBeat(room.playheadBeat() ?? 0)}`}
            onPointerDown={() => {
              keyboardScrubbing = false
              beginScrub()
            }}
            onPointerUp={finishScrub}
            onPointerCancel={finishScrub}
            onKeyDown={beginKeyboardScrub}
            onKeyUp={finishKeyboardScrub}
            onInput={previewScrub}
            onChange={() => {
              if (!keyboardScrubbing) finishScrub()
            }}
            onBlur={() => {
              keyboardScrubbing = false
              finishScrub()
            }}
          />
          <output aria-label="Score duration">
            {formatTime(room.durationSeconds())}
          </output>
        </div>

        <div class={styles.transportControls}>
          <button
            class={styles.playControl}
            type="button"
            aria-label={playbackLabel()}
            title={playbackLabel()}
            disabled={room.status() === 'starting' || isCalibrating()}
            onClick={togglePlayback}
          >
            <span aria-hidden="true">{isRunning() ? <Pause /> : <Play />}</span>
          </button>
          <div class={styles.playbackSpeed} role="group" aria-label="Tempo">
            <button
              type="button"
              aria-label={`Slow down from ${room.tempoBpm()} BPM`}
              disabled={
                takeIsActive() || room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO
              }
              onClick={() => room.setTempoBpm(room.tempoBpm() - 4)}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output aria-label={`Tempo ${room.tempoBpm()} BPM`}>
              <strong>{room.tempoBpm()}</strong>
              <small>BPM</small>
            </output>
            <button
              type="button"
              aria-label={`Speed up from ${room.tempoBpm()} BPM`}
              disabled={
                takeIsActive() || room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO
              }
              onClick={() => room.setTempoBpm(room.tempoBpm() + 4)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>

      <div class={styles.roomFooter}>
        <div class={styles.roomFooterActions}>
          <Show when={room.status() === 'complete'}>
            <button
              type="button"
              class={styles.replayTake}
              onClick={togglePlayback}
            >
              <span aria-hidden="true">
                <RotateCcw />
              </span>
              {loop.span() === null ? 'Replay' : 'Rehearse loop'}
            </button>
          </Show>
        </div>
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {room.status() === 'count-in'
              ? `${assessmentCaptureActive() ? 'Review count-in' : scoredCaptureActive() ? 'Live-score count-in' : 'Counting in'} · ${room.countInRemaining()}`
              : room.status() === 'playing'
                ? assessmentCaptureActive()
                  ? 'Listening to this phrase'
                  : scoredCaptureActive()
                    ? 'Scoring this take'
                    : 'Click is running'
                : room.status() === 'paused'
                  ? `${room.setupLocked() ? 'Paused' : 'Set'} · ${formatBeat(room.playheadBeat() ?? 0)}`
                  : room.status() === 'complete'
                    ? doctorView() !== null
                      ? 'Take ready to review'
                      : 'Take complete'
                    : room.status() === 'starting'
                      ? 'Opening the room clock'
                      : 'Ready when you are'}
          </strong>
          <small>
            {room.status() === 'quiet'
              ? 'Press Play or Space to start the count-in'
              : `${formatTime(room.displayPositionSeconds())} of ${formatTime(room.durationSeconds())}`}
          </small>
        </p>
      </div>

      <Show when={tunerOpen()}>
        <GuitarNightTunerExperience
          controller={tuner}
          tuning={tunerTuning}
          detectedFrequencyHz={listening.detectedFrequency}
          detectedNoteLabel={listening.currentNote}
          surfaceMode="overlay"
          showTuningPresets={() => !room.setupLocked()}
          recoveryActionLabel={() =>
            listening.canTakeOverInput() ? 'Use it here' : null
          }
          onRecoveryAction={() => void listening.useInputHere()}
          onBack={closeTuner}
        />
      </Show>
    </section>
  )
}
