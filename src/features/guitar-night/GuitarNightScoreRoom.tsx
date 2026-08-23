// The score room rehearses an imported tab alone — no recording, no backing stems.
// ============================================================
//
// A tab is a complete rehearsal on its own terms: count-in, click, and the same
// stage the play-along room uses. Explicit Listening may add a compact,
// evidence-bounded live score; phrase diagnosis remains a separate Review.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { ChevronLeft, Ear, Headphones, Metronome, Mic, MusicNote, Pause, Play, RotateCcw, SlidersHorizontal, Square, Trophy, Volume2, VolumeX, } from '@/components/icons'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import type { GuitarRoomBandNote } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { registerMusicPlayingSource, registerVoiceCommands, } from '@/features/voice-control/voice-command-registry'
import { compareGuitarDoctorWithHistory, loadGuitarDoctorHistory, saveGuitarDoctorHistory, } from '@/lib/guitar/guitar-doctor-history'
import { createGuitarPhraseAssessmentWindow, reviewGuitarPhrase, } from '@/lib/guitar/guitar-phrase-review'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { loadGuitarScoreHistory, saveGuitarScoreTake, summarizeGuitarScoreTake, } from '@/lib/guitar/guitar-score-history'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { createGuitarNightScoreVoiceCommands, GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES, } from './guitar-night-score-voice-commands'
import { guitarPhraseDoctorView, retainedTakeHealth, } from './guitar-phrase-doctor-view'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightInputHealth } from './GuitarNightInputHealth'
import { GuitarNightInputNotice } from './GuitarNightInputNotice'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'
import { GuitarNightDoctorCue, GuitarNightJamDoctor, } from './GuitarNightJamDoctor'
import type { GuitarNightListeningSelection } from './GuitarNightListeningCycle'
import { GuitarNightListeningCycle } from './GuitarNightListeningCycle'
import { GuitarNightLiveScore } from './GuitarNightLiveScore'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import { GuitarNightScoreSheet } from './GuitarNightScoreSheet'
import { GuitarNightSessionPanel } from './GuitarNightSessionPanel'
import { GuitarNightStage } from './GuitarNightStage'
import { GuitarNightTunerExperience } from './GuitarNightTunerExperience'
import type { GuitarNightReference } from './reference-port'
import type { SheetLane } from './sheet/sheet-model'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightLiveScoreController } from './useGuitarNightLiveScoreController'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import type { GuitarNightScoreAssessmentBoundary, GuitarNightScoreRoomStatus, } from './useGuitarNightScoreRoomController'
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
  /** Every part the sheet draws, in written order. */
  sheetLanes?: Accessor<readonly SheetLane[]>
  sheetTimeSignatures?: Accessor<readonly MidiTimeSignature[] | undefined>
  /** One other part, drawn small in a corner of the moving views. */
  secondaryLane?: Accessor<SheetLane | null>
  /** The rest of the band, already carrying each part's own timbre. */
  backingMelody?: Accessor<readonly GuitarRoomBandNote[]>
  /** Whether the scored part sounds when the player has not said either way. */
  defaultHearScore?: Accessor<boolean>
  /** Parts currently playing under the player, for the panel's controls. */
  audibleBackingTrackIds?: Accessor<readonly string[]>
  /** Explicit M state, independent from the temporary Solo audition. */
  mutedBackingTrackIds?: Accessor<readonly string[]>
  onToggleBackingTrack?(trackId: string): void
  soloedBackingTrackId?: Accessor<string | null>
  onToggleSoloBackingTrack?(trackId: string): void
  /** Parts currently on the sheet, for the panel's show and hide controls. */
  sheetVisibleTrackIds?: Accessor<readonly string[]>
  onToggleSheetTrack?(trackId: string): void
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

function formatCountInChoice(beats: number): string {
  if (beats === 0) return 'Off'
  return `${beats} ${beats === 1 ? 'beat' : 'beats'}`
}

export function nextScoreCountIn(current: number): number {
  const index = GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.findIndex(
    (choice) => choice === current,
  )
  return (
    GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES[
      index < 0 ? 0 : (index + 1) % GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.length
    ] ?? 0
  )
}

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

/** Keep result actions parked while the recorder attaches its final pitch. */
export function scoreResultIsSettling(
  roomStatus: GuitarNightScoreRoomStatus,
  captureActive: boolean,
  manualEndPending = false,
): boolean {
  return manualEndPending || (captureActive && roomStatus === 'complete')
}

/** Voice Play/Pause must treat async audio startup as active transport. */
export function scoreVoiceTransportIsPlaying(
  roomStatus: GuitarNightScoreRoomStatus,
): boolean {
  return (
    roomStatus === 'starting' ||
    roomStatus === 'count-in' ||
    roomStatus === 'playing'
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
  let scoreTrigger: HTMLButtonElement | undefined
  let disposed = false
  const [sessionPanelOpen, setSessionPanelOpen] = createSignal(false)
  const [doctorOpen, setDoctorOpen] = createSignal(false)
  const [tunerOpen, setTunerOpen] = createSignal(false)
  const [scoreOpen, setScoreOpen] = createSignal(false)
  const [currentScoreSummary, setCurrentScoreSummary] =
    createSignal<GuitarScoreTakeSummary | null>(null)
  const [currentScoreBoundaryId, setCurrentScoreBoundaryId] = createSignal<
    string | null
  >(null)
  const [scoreHistory, setScoreHistory] = createSignal<
    readonly GuitarScoreTakeSummary[]
  >([])
  const [doctorRecoveryActive, setDoctorRecoveryActive] = createSignal(false)
  const [scoreReplayPending, setScoreReplayPending] = createSignal(false)
  const [scoreResumePending, setScoreResumePending] = createSignal(false)
  const [listeningRouteOperation, setListeningRouteOperation] = createSignal<
    number | null
  >(null)
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
    backingMelody: () => props.backingMelody?.() ?? [],
    audibleBackingTrackIds: () => props.audibleBackingTrackIds?.() ?? [],
    defaultHearScore: () => props.defaultHearScore?.() ?? true,
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
    completeTakeNow: listening.completeTakeNow,
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
  const hasBackingParts = createMemo(
    () => (props.backingMelody?.().length ?? 0) > 0,
  )
  const backingPartsSound = createMemo(
    () =>
      hasBackingParts() &&
      room.hearBacking() &&
      (props.audibleBackingTrackIds === undefined ||
        props.audibleBackingTrackIds().length > 0),
  )
  const roomMicMixWarning = createMemo(
    () =>
      listening.status() === 'listening' &&
      listening.inputProfile() === 'microphone' &&
      room.masterVolume() > 0.001 &&
      (room.hearScore() || backingPartsSound()),
  )
  let savedScoreRunId: string | null = null
  createEffect(() => {
    const display = liveScore.display()
    const boundary = liveScore.boundary()
    const startedAt = liveScore.startedAt()
    const inputKind = liveScore.inputKind()
    if (
      display === null ||
      boundary === null ||
      startedAt === null ||
      inputKind === null
    ) {
      return
    }
    const status =
      display.phase === 'completed'
        ? 'completed'
        : liveScore.state() === 'paused'
          ? 'partial'
          : null
    if (status === null) return
    const summary = summarizeGuitarScoreTake(
      display,
      {
        pieceLabel: boundary.reference.title,
        trackLabel: boundary.reference.trackName,
        range: {
          startBeat: boundary.range.start,
          endBeat: boundary.range.end,
        },
        inputKind,
        status,
      },
      startedAt,
    )
    if (summary === null) return
    setCurrentScoreSummary(summary)
    setCurrentScoreBoundaryId(boundary.id)
    if (status !== 'completed' || savedScoreRunId === boundary.id) return
    savedScoreRunId = boundary.id
    try {
      if (saveGuitarScoreTake(globalThis.localStorage, summary) !== null) {
        setScoreHistory(loadGuitarScoreHistory(globalThis.localStorage))
      }
    } catch {
      // The in-memory result remains useful when device storage is unavailable.
    }
  })
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
  // Mark edits are handed to the room clock immediately. Keep a truthful
  // transient state visible while its scheduler relaunch finishes.
  const loopPendingRestart = createMemo(() =>
    scoreLoopPendingRestart(loop.span(), room.runningLoop(), takeIsActive()),
  )
  const isCalibrating = createMemo(() => listening.status() === 'calibrating')
  const inputTransitionPending = createMemo(
    () =>
      listeningRouteOperation() !== null ||
      listening.status() === 'requesting' ||
      isCalibrating() ||
      listening.inputTakeoverPending(),
  )
  const scoreResultSettling = createMemo(() =>
    scoreResultIsSettling(
      room.status(),
      scoredCaptureActive(),
      liveScore.finishing(),
    ),
  )
  const toolTransitionPending = createMemo(
    () =>
      assessmentPending() ||
      liveScore.starting() ||
      scoreReplayPending() ||
      scoreResumePending() ||
      doctorRecoveryActive() ||
      inputTransitionPending() ||
      scoreResultSettling(),
  )
  const loopEditBlocked = createMemo(
    () =>
      toolTransitionPending() ||
      assessmentCaptureActive() ||
      scoredCaptureActive(),
  )

  /** Score-room loops land on whole beats so the click keeps one downbeat. */
  const markLoopAtPlayhead = (mark: 'A' | 'B'): boolean => {
    if (loopEditBlocked()) return false
    const fallback = mark === 'A' ? 0 : scoreBeats()
    const beat = Math.round(room.playheadBeat() ?? fallback)
    if (mark === 'A') loop.markStart(beat)
    else loop.markEnd(beat)
    void room.applyLoopSpan(loop.span())
    return true
  }

  const previewLoopBoundary = (mark: 'A' | 'B', beat: number): void => {
    if (loopEditBlocked()) return
    loop.moveMark(mark, Math.round(beat))
  }

  const commitLoopBoundary = (): void => {
    if (loopEditBlocked()) return
    void room.applyLoopSpan(loop.span())
  }

  const clearScoreLoop = (): boolean => {
    if (loopEditBlocked()) return false
    loop.clear()
    void room.applyLoopSpan(null)
    return true
  }

  const scoreReplay = createMemo(() => {
    const summary = currentScoreSummary()
    const boundary = liveScore.boundary()
    const current = props.reference()
    if (
      summary === null ||
      boundary === null ||
      currentScoreBoundaryId() !== boundary.id ||
      boundary.reference.songId !== current.songId ||
      boundary.reference.trackId !== current.trackId ||
      summary.range.startBeat !== boundary.range.start ||
      summary.range.endBeat !== boundary.range.end
    ) {
      return null
    }
    return {
      summary,
      inputKind: summary.inputKind,
      referenceId: boundary.reference.songId,
      trackId: boundary.reference.trackId,
      range: {
        start: boundary.range.start,
        end: boundary.range.end,
      } satisfies LoopSpan,
    }
  })
  const isListening = createMemo(
    () =>
      listening.status() === 'listening' ||
      listening.status() === 'requesting' ||
      isCalibrating(),
  )
  const playbackLabel = createMemo(() => {
    if (scoreReplayPending()) return 'Opening input for replay'
    if (scoreResumePending()) return 'Starting a fresh live score'
    if (scoreResultSettling()) return 'Finishing the live score'
    if (room.status() === 'starting') return 'Opening the room clock'
    if (isRunning()) return 'Pause score'
    if (room.status() === 'paused') {
      if (loopPendingRestart()) return 'Start updated loop'
      if (liveScore.state() === 'paused') return 'Start a fresh live score'
      if (liveScore.state() === 'complete') {
        return loop.span() === null ? 'Replay score' : 'Rehearse loop'
      }
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
  let scoreReplayGeneration = 0
  let scoreResumeGeneration = 0
  let scoreResumeOrigin: 'paused' | 'complete' | null = null
  let listeningCycleGeneration = 0

  const invalidateScoreReplay = (): void => {
    scoreReplayGeneration += 1
    setScoreReplayPending(false)
  }

  const invalidateScoreResume = (): void => {
    scoreResumeGeneration += 1
    setScoreResumePending(false)
    scoreResumeOrigin = null
  }

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
    if (
      range === null ||
      assessmentPending() ||
      inputTransitionPending() ||
      scoreReplayPending() ||
      props.suspended?.() === true
    ) {
      return false
    }

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

  /** End evidence honestly, then leave the playhead where configuration began. */
  const parkForConfiguration = (): void => {
    if (assessmentCaptureActive()) listening.stop()
    if (scoredCaptureActive()) {
      liveScore.hold()
      listening.stop()
    }
    room.parkForConfiguration()
  }

  const toggleListening = (): void => {
    listeningCycleGeneration += 1
    setListeningRouteOperation(null)
    if (isListening()) {
      const scoring = scoredCaptureActive()
      if (scoring) liveScore.hold()
      if (assessmentCaptureActive() || scoring) room.pause()
      listening.stop()
      room.parkForConfiguration()
      return
    }
    // The score voice is pitched audio. Letting the microphone listen to it
    // would make the room appear to hear the player when it heard itself.
    parkForConfiguration()
    liveScore.clear()
    void listening.start()
  }

  const selectListeningRoute = async (
    next: GuitarNightListeningSelection,
  ): Promise<void> => {
    const operation = ++listeningCycleGeneration
    setListeningRouteOperation(operation)
    try {
      if (next === null) {
        if (isListening()) toggleListening()
        return
      }

      parkForConfiguration()
      liveScore.clear()
      if (listening.inputProfile() !== next) {
        await listening.selectInputProfile(next)
      }
      if (
        operation !== listeningCycleGeneration ||
        disposed ||
        props.suspended?.() === true
      ) {
        return
      }
      if (listening.status() !== 'listening') await listening.start()
    } finally {
      if (listeningRouteOperation() === operation) {
        setListeningRouteOperation(null)
      }
    }
  }

  const configureListeningRoute = async (
    configure: () => Promise<unknown>,
  ): Promise<void> => {
    const operation = ++listeningCycleGeneration
    setListeningRouteOperation(operation)
    parkForConfiguration()
    try {
      await configure()
    } finally {
      if (listeningRouteOperation() === operation) {
        setListeningRouteOperation(null)
      }
    }
  }

  const stopRehearsal = (): void => {
    const replayWasPending = scoreReplayPending()
    const resumeWasPending = scoreResumePending()
    const resumeOrigin = scoreResumeOrigin
    const inputWasPending = inputTransitionPending()
    listeningCycleGeneration += 1
    setListeningRouteOperation(null)
    invalidateScoreReplay()
    invalidateScoreResume()
    if (!resumeWasPending && (replayWasPending || inputWasPending)) {
      listening.cancel()
    }
    if (resumeWasPending) {
      // Cancelling permission or scheduler admission must not turn the held
      // partial into a completed take or erase it.
      if (resumeOrigin === 'complete') liveScore.finish()
      else liveScore.hold()
      listening.cancel()
      room.pause()
      return
    }
    if (assessmentCaptureActive()) listening.stop()
    if (!liveScore.finish() && scoredCaptureActive()) {
      liveScore.hold()
      listening.stop()
    }
    room.stop()
  }

  const goToBeginning = (): void => {
    parkForConfiguration()
    room.seekSeconds(0)
  }

  const cycleCountIn = (): void => {
    room.setCountInBeats(nextScoreCountIn(room.configuredCountInBeats()))
  }

  const selectScoredTrack = (trackId: string): void => {
    if (trackId === displayedReference().trackId) return
    parkForConfiguration()
    props.onSelectTrack?.(trackId)
  }

  const hasScoreToShow = createMemo(
    () => scoreReplay() !== null || scoreHistory().length > 0,
  )

  const openScore = (allowEmpty = true): boolean => {
    if (toolTransitionPending()) return false
    if (!allowEmpty && !hasScoreToShow() && !scoredCaptureActive()) return false
    parkForConfiguration()
    setDoctorOpen(false)
    setTunerOpen(false)
    setSessionPanelOpen(false)
    if (sessionDetails !== undefined) sessionDetails.open = false
    setScoreOpen(true)
    return true
  }

  const playScoreAgain = async (): Promise<void> => {
    const replay = scoreReplay()
    if (replay === null) return
    const operation = ++scoreReplayGeneration
    const stillCurrent = (): boolean =>
      operation === scoreReplayGeneration &&
      !disposed &&
      props.suspended?.() !== true &&
      props.reference().songId === replay.referenceId &&
      props.reference().trackId === replay.trackId
    setScoreReplayPending(true)
    setScoreOpen(false)
    parkForConfiguration()
    try {
      if (listening.inputProfile() !== replay.inputKind) {
        await listening.selectInputProfile(replay.inputKind)
        if (!stillCurrent()) return
      }
      const inputReady =
        listening.status() === 'listening' || (await listening.start())
      if (!inputReady || !stillCurrent()) return
      await liveScore.start(replay.range)
    } finally {
      if (operation === scoreReplayGeneration) {
        setScoreReplayPending(false)
      }
    }
  }

  /**
   * Pause and completion close the recorder rather than extending one take
   * across silence. The next Play reopens the selected route and admits a new
   * score from the parked beat. The prior result remains visible until every
   * owner needed by that new run has accepted it.
   */
  const restartScoredRun = async (): Promise<void> => {
    const range = selectedLiveScoreRange()
    const referenceId = props.reference().songId
    const trackId = props.reference().trackId
    const scoreState = liveScore.state()
    if (
      range === null ||
      scoreResumePending() ||
      (scoreState !== 'paused' && scoreState !== 'complete')
    ) {
      return
    }

    const operation = ++scoreResumeGeneration
    scoreResumeOrigin = scoreState
    const stillCurrent = (): boolean =>
      operation === scoreResumeGeneration &&
      !disposed &&
      props.suspended?.() !== true &&
      props.reference().songId === referenceId &&
      props.reference().trackId === trackId
    setScoreResumePending(true)
    sessionDetails.open = false
    setDoctorOpen(false)
    try {
      const inputReady =
        listening.status() === 'listening' || (await listening.start())
      if (!inputReady || !stillCurrent()) return
      const admitted = await liveScore.start(range)
      if (!admitted && stillCurrent()) {
        // startLiveScore may release a failed scheduler. Restore the exact
        // musical position whose Play request we were trying to admit.
        room.seekBeat(range.start)
      }
    } finally {
      if (operation === scoreResumeGeneration) {
        setScoreResumePending(false)
        scoreResumeOrigin = null
      }
    }
  }

  const reviewFromScore = (): void => {
    setScoreOpen(false)
    if (doctorView() !== null) {
      setDoctorRecoveryActive(false)
      setDoctorOpen(true)
      return
    }
    void beginAssessment()
  }

  const togglePlayback = (): void => {
    if (
      scoreReplayPending() ||
      scoreResumePending() ||
      assessmentPending() ||
      liveScore.starting() ||
      doctorRecoveryActive() ||
      inputTransitionPending()
    ) {
      return
    }
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
    if (liveScore.state() === 'paused' || liveScore.state() === 'complete') {
      void restartScoredRun()
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
        if (
          !opened ||
          disposed ||
          props.suspended?.() === true ||
          !doctorRecoveryActive()
        ) {
          if (
            !disposed &&
            props.suspended?.() !== true &&
            doctorRecoveryActive()
          ) {
            setDoctorOpen(true)
          }
          return
        }
        if (!(await listening.calibrate())) {
          listening.cancel({ preserveNotice: true })
          if (
            !disposed &&
            props.suspended?.() !== true &&
            doctorRecoveryActive()
          ) {
            setDoctorOpen(true)
          }
          return
        }
      }
      if (disposed || props.suspended?.() === true || !doctorRecoveryActive()) {
        return
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
      toolTransitionPending() ||
      assessmentCaptureActive() ||
      scoredCaptureActive()
    ) {
      return
    }
    parkForConfiguration()
    setDoctorOpen(false)
    setScoreOpen(false)
    setSessionPanelOpen(false)
    setTunerOpen(true)
  }

  const closeTuner = (): void => {
    setTunerOpen(false)
    queueMicrotask(() => tunerTrigger?.focus())
  }

  const finishScrub = (): void => {
    if (!scrubbing) return
    const shouldResume = resumeAfterScrub
    scrubbing = false
    resumeAfterScrub = false
    if (
      shouldResume &&
      room.status() === 'paused' &&
      !disposed &&
      props.suspended?.() !== true &&
      !toolTransitionPending() &&
      !doctorOpen() &&
      !tunerOpen() &&
      !scoreOpen() &&
      !sessionPanelOpen()
    ) {
      void room.start()
    }
  }

  const seekScoreBeat = (beat: number): void => {
    if (toolTransitionPending()) return
    room.seekBeat(beat)
  }

  const seekScoreSeconds = (seconds: number): void => {
    if (toolTransitionPending()) return
    beginScrub()
    room.seekSeconds(seconds)
    finishScrub()
  }

  const changeInstrument = (instrument: StringedInstrument): void => {
    parkForConfiguration()
    props.onInstrument?.(instrument)
  }

  const changeStringCount = (count: number): void => {
    parkForConfiguration()
    props.onStringCount?.(count)
  }

  const leaveRoom = (): void => {
    invalidateScoreReplay()
    invalidateScoreResume()
    tuner.close()
    liveScore.clear()
    listening.stop()
    room.stop()
    props.onSongs()
  }

  const voiceCommands = createGuitarNightScoreVoiceCommands({
    playing: () => scoreVoiceTransportIsPlaying(room.status()),
    paused: () => room.status() === 'paused',
    canStop: () => room.status() !== 'quiet',
    play: togglePlayback,
    pause: togglePlayback,
    stop: stopRehearsal,
    goToBeginning,
    seek: {
      positionSeconds: room.displayPositionSeconds,
      durationSeconds: room.durationSeconds,
      seekSeconds: seekScoreSeconds,
    },
    loop: {
      hasA: () => loop.markA() !== null,
      hasB: () => loop.markB() !== null,
      blockedReason: () =>
        loopEditBlocked()
          ? assessmentCaptureActive() || scoredCaptureActive()
            ? 'Finish the scored take before changing its loop'
            : 'The room is finishing another action'
          : null,
      markA: () => markLoopAtPlayhead('A'),
      markB: () => markLoopAtPlayhead('B'),
      clear: clearScoreLoop,
    },
    click: {
      enabled: room.hearClick,
      setEnabled: room.setHearClick,
    },
    countIn: {
      beats: room.configuredCountInBeats,
      setBeats: room.setCountInBeats,
    },
    tabSound: {
      enabled: room.hearScore,
      setEnabled: room.setHearScore,
    },
    listening: {
      active: isListening,
      blockedReason: () =>
        isCalibrating()
          ? 'Input calibration is in progress'
          : listening.inputTakeoverPending()
            ? 'Input is switching rooms'
            : null,
      requestStart: () => {
        toggleListening()
        return true
      },
      stop: toggleListening,
    },
    score: {
      open: scoreOpen,
      show: () => openScore(false),
    },
    available: () =>
      props.suspended?.() !== true &&
      !toolTransitionPending() &&
      !doctorOpen() &&
      !tunerOpen() &&
      !scoreOpen() &&
      !sessionPanelOpen(),
  })
  onCleanup(registerVoiceCommands(() => voiceCommands))
  // The shared transport registry polls this accessor outside Solid tracking.
  // eslint-disable-next-line solid/reactivity
  onCleanup(registerMusicPlayingSource(() => isRunning()))

  createEffect(() => {
    if (props.suspended?.() !== true) return
    listeningCycleGeneration += 1
    setListeningRouteOperation(null)
    scrubbing = false
    resumeAfterScrub = false
    setDoctorOpen(false)
    setDoctorRecoveryActive(false)
    invalidateScoreReplay()
    invalidateScoreResume()
    setTunerOpen(false)
    setScoreOpen(false)
    setSessionPanelOpen(false)
    if (sessionDetails !== undefined) sessionDetails.open = false
    tuner.close()
    if (scoredCaptureActive()) liveScore.hold()
    listening.stop()
    room.pause()
  })

  onCleanup(() => {
    disposed = true
    listeningCycleGeneration += 1
    setListeningRouteOperation(null)
    invalidateScoreResume()
    scrubbing = false
    resumeAfterScrub = false
  })

  onMount(() => {
    try {
      setScoreHistory(loadGuitarScoreHistory(globalThis.localStorage))
    } catch {
      setScoreHistory([])
    }
    roomHeading.focus({ preventScroll: true })
    onCleanup(
      installSpacePlaybackToggle({
        toggle: togglePlayback,
        ownsSpace: () =>
          props.suspended?.() !== true &&
          !doctorOpen() &&
          !tunerOpen() &&
          !scoreOpen() &&
          !sessionPanelOpen(),
        enabled: () => room.status() !== 'starting' && !toolTransitionPending(),
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
            disabled={toolTransitionPending()}
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
              ref={scoreTrigger}
              type="button"
              aria-haspopup="dialog"
              aria-label="Open score"
              title={
                scoreResultSettling() ? 'Finishing the live score' : 'Score'
              }
              disabled={toolTransitionPending()}
              onClick={() => openScore()}
            >
              <span aria-hidden="true">
                <Trophy />
              </span>
              <strong>Score</strong>
            </button>
            <button
              ref={tunerTrigger}
              type="button"
              aria-haspopup="dialog"
              aria-label="Tune guitar"
              disabled={
                toolTransitionPending() ||
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
                      {isRunning()
                        ? 'Mix controls stay live. Tempo or input parks at this beat.'
                        : room.status() === 'paused'
                          ? 'Change anything. The next count-in starts here.'
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
                    listeningRouteOperation() !== null ||
                    listening.status() === 'requesting' ||
                    listening.status() === 'calibrating' ||
                    listening.inputTakeoverPending() ||
                    listening.midiConnectionStatus() === 'requesting'
                  }
                  onProfile={(kind) => {
                    void configureListeningRoute(() =>
                      listening.selectInputProfile(kind),
                    )
                  }}
                  onAudioInput={(deviceId) => {
                    void configureListeningRoute(() =>
                      listening.selectAudioInput(deviceId),
                    )
                  }}
                  onMidiInput={(deviceId) => {
                    void configureListeningRoute(() =>
                      listening.selectMidiInput(deviceId),
                    )
                  }}
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
                  disabled={
                    listeningRouteOperation() !== null && !isListening()
                  }
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
                    locked={isRunning}
                    onCalibrate={() => {
                      parkForConfiguration()
                      void listening.calibrate()
                    }}
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
                    toolTransitionPending()
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

                <div
                  class={styles.scoreSessionMix}
                  aria-label="Tempo and rehearsal volume"
                >
                  <div
                    class={styles.playbackSpeed}
                    role="group"
                    aria-label="Session tempo"
                  >
                    <button
                      type="button"
                      aria-label={`Slow down from ${room.tempoBpm()} BPM`}
                      disabled={
                        room.status() === 'starting' ||
                        toolTransitionPending() ||
                        room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO
                      }
                      onClick={() => {
                        parkForConfiguration()
                        room.setTempoBpm(room.tempoBpm() - 4)
                      }}
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
                        room.status() === 'starting' ||
                        toolTransitionPending() ||
                        room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO
                      }
                      onClick={() => {
                        parkForConfiguration()
                        room.setTempoBpm(room.tempoBpm() + 4)
                      }}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                  <label
                    class={`${styles.masterVolume} ${styles.scoreSessionVolume}`}
                  >
                    <span aria-hidden="true">
                      <Volume2 />
                    </span>
                    <span class={styles.visuallyHidden}>
                      Session rehearsal mix volume
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={room.masterVolume()}
                      aria-label="Session rehearsal mix volume"
                      aria-valuetext={`${Math.round(room.masterVolume() * 100)}%`}
                      onInput={(event) =>
                        room.setMasterVolume(Number(event.currentTarget.value))
                      }
                    />
                    <output aria-hidden="true">
                      {Math.round(room.masterVolume() * 100)}%
                    </output>
                  </label>
                </div>

                <div class={styles.scoreSessionSettings}>
                  <button
                    type="button"
                    class={styles.countInCycle}
                    aria-label={`Count-in ${formatCountInChoice(room.configuredCountInBeats())}. Change count-in`}
                    title="Change count-in: Off, 1, 2, or 4 beats"
                    onClick={cycleCountIn}
                  >
                    <span aria-hidden="true">
                      <Ear />
                    </span>
                    <span>
                      <strong>Count-in</strong>
                      <small>
                        {formatCountInChoice(room.configuredCountInBeats())}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    class={styles.hearScoreToggle}
                    aria-pressed={room.hearScore()}
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
                          : 'The band plays it for you.'}
                      </small>
                    </span>
                  </button>
                  {/* The click used to run whenever the room did, with nothing
                      anywhere to quiet it. Unlike its neighbours this one is
                      NOT held during a take: a click is only ever annoying
                      while it is ticking, so refusing to quiet it then is
                      refusing at exactly the moment it is asked. The band
                      reads this on every beat. */}
                  <button
                    type="button"
                    class={styles.hearScoreToggle}
                    aria-pressed={room.hearClick()}
                    classList={{ [styles.hearScoreActive]: room.hearClick() }}
                    onClick={() => room.setHearClick((ticking) => !ticking)}
                  >
                    <span aria-hidden="true">
                      <Metronome />
                    </span>
                    <span>
                      <strong>
                        {room.hearClick() ? 'Click on' : 'Click off'}
                      </strong>
                      <small>
                        {room.hearClick()
                          ? 'A pulse under the take.'
                          : 'The count-in still counts you in.'}
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
                    disabled={loopEditBlocked()}
                    format={formatBeat}
                    onMarkStart={() => markLoopAtPlayhead('A')}
                    onMarkEnd={() => markLoopAtPlayhead('B')}
                    onClear={clearScoreLoop}
                  />
                  <Show when={loopPendingRestart()}>
                    <small class={styles.scoreSessionNotice} role="status">
                      {isRunning()
                        ? 'Moving playback to the updated A mark.'
                        : 'The updated loop begins on the next Play.'}
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
        {...(props.sheetLanes === undefined
          ? {}
          : { sheetLanes: props.sheetLanes })}
        {...(props.sheetTimeSignatures === undefined
          ? {}
          : { sheetTimeSignatures: props.sheetTimeSignatures })}
        {...(props.secondaryLane === undefined
          ? {}
          : { secondaryLane: props.secondaryLane })}
        scoredTrackId={() => displayedReference().trackId}
        loopStart={loop.markA}
        loopEnd={loop.markB}
        loopActive={loop.isLooping}
        loopEditingDisabled={loopEditBlocked}
        onMoveLoopMark={previewLoopBoundary}
        onCommitLoopMark={() => commitLoopBoundary()}
        onSeekBeat={seekScoreBeat}
        onSeekStart={beginScrub}
        onSeekEnd={finishScrub}
        seekDisabled={toolTransitionPending}
        {...(props.onSelectTrack === undefined
          ? {}
          : {
              onSelectTrack: selectScoredTrack,
            })}
        onInstrument={
          props.onInstrument === undefined ? undefined : changeInstrument
        }
        onStringCount={
          props.onStringCount === undefined ? undefined : changeStringCount
        }
        instrumentSetupDisabled={() => isRunning()}
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
          {...(props.sheetVisibleTrackIds === undefined
            ? {}
            : { visibleTrackIds: props.sheetVisibleTrackIds })}
          {...(props.onToggleSheetTrack === undefined
            ? {}
            : { onToggleTrackVisible: props.onToggleSheetTrack })}
          {...(props.audibleBackingTrackIds === undefined
            ? {}
            : { audibleTrackIds: props.audibleBackingTrackIds })}
          {...(props.mutedBackingTrackIds === undefined
            ? {}
            : { mutedTrackIds: props.mutedBackingTrackIds })}
          {...(props.onToggleBackingTrack === undefined
            ? {}
            : { onToggleTrackAudible: props.onToggleBackingTrack })}
          backingMasterEnabled={room.hearBacking}
          onToggleBackingMaster={() =>
            room.setHearBacking((hearing) => !hearing)
          }
          {...(props.soloedBackingTrackId === undefined
            ? {}
            : { soloedTrackId: props.soloedBackingTrackId })}
          {...(props.onToggleSoloBackingTrack === undefined
            ? {}
            : { onToggleTrackSolo: props.onToggleSoloBackingTrack })}
          scoredPartSounds={room.hearScore}
          onSelectTrack={(trackId) => {
            selectScoredTrack(trackId)
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
        <div class={styles.scoreClockChip}>
          <span aria-hidden="true" />
          <strong>
            {assessmentCaptureActive()
              ? 'Phrase review'
              : scoreReplayPending() || scoreResumePending()
                ? 'Opening input'
                : scoreResultSettling()
                  ? 'Final note'
                  : scoredCaptureActive() || liveScore.starting()
                    ? 'Live score'
                    : loopPendingRestart()
                      ? 'Loop ready'
                      : 'Score clock'}
          </strong>
          <small>{formatBeat(room.playheadBeat() ?? 0)}</small>
        </div>

        <div class={styles.scoreListeningDock}>
          <GuitarNightListeningCycle
            status={listening.status}
            profile={listening.inputProfile}
            disabled={() =>
              props.suspended?.() === true || toolTransitionPending()
            }
            onSelect={selectListeningRoute}
          />
          <div
            class={styles.scoreListeningMix}
            role="group"
            aria-label="Listening playback mix"
          >
            <Show when={hasBackingParts()}>
              <button
                type="button"
                class={styles.scoreListeningMixToggle}
                classList={{
                  [styles.scoreListeningMixToggleActive]: room.hearBacking(),
                }}
                aria-pressed={room.hearBacking()}
                aria-label={
                  room.hearBacking()
                    ? 'Mute backing parts'
                    : 'Hear backing parts'
                }
                title={
                  room.hearBacking()
                    ? 'Backing parts sound'
                    : 'Backing parts are silent'
                }
                disabled={props.suspended?.() === true}
                onClick={() => room.setHearBacking((hearing) => !hearing)}
              >
                <span aria-hidden="true">
                  <Show when={room.hearBacking()} fallback={<VolumeX />}>
                    <Volume2 />
                  </Show>
                </span>
                <small>Backing</small>
              </button>
            </Show>
            <button
              type="button"
              class={styles.scoreListeningMixToggle}
              classList={{
                [styles.scoreListeningMixToggleActive]: room.hearScore(),
              }}
              aria-pressed={room.hearScore()}
              aria-label={
                room.hearScore() ? 'Mute target guide' : 'Hear target guide'
              }
              title={
                room.hearScore()
                  ? 'Target guide sounds'
                  : 'Target guide is silent'
              }
              disabled={props.suspended?.() === true}
              onClick={() => room.setHearScore((hearing) => !hearing)}
            >
              <span aria-hidden="true">
                <Show when={room.hearScore()} fallback={<VolumeX />}>
                  <Volume2 />
                </Show>
              </span>
              <small>Target</small>
            </button>
          </div>
          <Show when={roomMicMixWarning()}>
            <p
              class={styles.scoreListeningWarning}
              role="note"
              title="Room mic can hear speaker playback. Use headphones for a clean score."
            >
              <span aria-hidden="true">
                <Headphones />
              </span>
              <span class={styles.scoreListeningWarningCopy} aria-hidden="true">
                <strong>Mic may hear speakers</strong>
                <small>Use headphones</small>
              </span>
              <span class={styles.visuallyHidden}>
                Room mic can hear speaker playback. Use headphones for a clean
                score.
              </span>
            </p>
          </Show>
        </div>

        <div class={styles.timeRail}>
          <output aria-label="Elapsed score time">
            {formatTime(room.displayPositionSeconds())}
          </output>
          <LoopRangeRail
            axisDomain={() => ({
              start: 0,
              end: room.durationSeconds() > 0 ? room.durationSeconds() : 1,
            })}
            axisValue={room.displayPositionSeconds}
            markDomain={() => ({ start: 0, end: scoreBeats() })}
            markA={loop.markA}
            markB={loop.markB}
            toAxis={room.secondsForBeat}
            fromAxis={room.beatForSeconds}
            active={loop.isLooping}
            disabled={toolTransitionPending}
            marksDisabled={loopEditBlocked}
            axisStep={() => Math.max(0.05, 15 / room.tempoBpm())}
            markStep={() => 1}
            minimumMarkGap={() => 1}
            formatAxisValue={(seconds) =>
              `${formatTime(seconds)} of ${formatTime(room.durationSeconds())} · ${formatBeat(room.beatForSeconds(seconds))}`
            }
            formatMarkValue={formatBeat}
            seekLabel="Score position"
            onSeek={(seconds) => room.seekSeconds(seconds)}
            onScrubStart={beginScrub}
            onScrubEnd={finishScrub}
            snapMarkValue={(beat) => Math.round(beat)}
            onMoveMarkA={(beat) => previewLoopBoundary('A', beat)}
            onMoveMarkB={(beat) => previewLoopBoundary('B', beat)}
            onCommitMark={commitLoopBoundary}
            testIdPrefix="guitar-night-score"
          />
          <output aria-label="Score duration">
            {formatTime(room.durationSeconds())}
          </output>
        </div>

        <div class={styles.scoreRailLoop}>
          <GuitarNightLoopControls
            span={loop.span()}
            pending={loop.isPending()}
            hasStart={loop.markA() !== null}
            hasEnd={loop.markB() !== null}
            disabled={loopEditBlocked()}
            format={formatBeat}
            onMarkStart={() => markLoopAtPlayhead('A')}
            onMarkEnd={() => markLoopAtPlayhead('B')}
            onClear={clearScoreLoop}
          />
        </div>

        <div
          class={styles.transportControls}
          role="group"
          aria-label="Rehearsal transport"
          data-testid="guitar-night-score-transport-controls"
        >
          <div class={styles.scorePrimaryTransport}>
            <button
              class={styles.playControl}
              type="button"
              aria-label={playbackLabel()}
              title={playbackLabel()}
              disabled={room.status() === 'starting' || toolTransitionPending()}
              onClick={togglePlayback}
            >
              <span aria-hidden="true">
                {isRunning() ? <Pause /> : <Play />}
              </span>
            </button>
            {/* A separate End action releases the pinned take without moving
                setup controls away from the current beat. */}
            <Show
              when={
                room.setupLocked() ||
                scoreReplayPending() ||
                scoreResumePending()
              }
            >
              <button
                class={styles.stopControl}
                type="button"
                aria-label={
                  scoreReplayPending()
                    ? 'Cancel replay'
                    : scoreResumePending()
                      ? 'Cancel score start'
                      : 'End the take'
                }
                title={
                  scoreReplayPending()
                    ? 'Cancel replay'
                    : scoreResumePending()
                      ? 'Cancel score start'
                      : 'End the take'
                }
                onClick={stopRehearsal}
              >
                <span aria-hidden="true">
                  <Square />
                </span>
              </button>
            </Show>
          </div>

          <div class={styles.scoreMixStrip}>
            <div class={styles.playbackSpeed} role="group" aria-label="Tempo">
              <button
                type="button"
                aria-label={`Slow down from ${room.tempoBpm()} BPM`}
                disabled={
                  room.status() === 'starting' ||
                  toolTransitionPending() ||
                  room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO
                }
                onClick={() => {
                  parkForConfiguration()
                  room.setTempoBpm(room.tempoBpm() - 4)
                }}
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
                  room.status() === 'starting' ||
                  toolTransitionPending() ||
                  room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO
                }
                onClick={() => {
                  parkForConfiguration()
                  room.setTempoBpm(room.tempoBpm() + 4)
                }}
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
            <label class={`${styles.masterVolume} ${styles.scoreMasterVolume}`}>
              <span aria-hidden="true">
                <Volume2 />
              </span>
              <span class={styles.visuallyHidden}>Rehearsal mix volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={room.masterVolume()}
                aria-label="Rehearsal mix volume"
                aria-valuetext={`${Math.round(room.masterVolume() * 100)}%`}
                onInput={(event) =>
                  room.setMasterVolume(Number(event.currentTarget.value))
                }
              />
              <output aria-hidden="true">
                {Math.round(room.masterVolume() * 100)}%
              </output>
            </label>
          </div>

          <div class={styles.scoreUtilities}>
            <button
              type="button"
              class={styles.scoreRailToggle}
              classList={{ [styles.scoreRailToggleActive]: room.hearClick() }}
              aria-pressed={room.hearClick()}
              aria-label={room.hearClick() ? 'Turn click off' : 'Turn click on'}
              title={room.hearClick() ? 'Click on' : 'Click off'}
              onClick={() => room.setHearClick((ticking) => !ticking)}
            >
              <span aria-hidden="true">
                <Metronome />
              </span>
              <small>Click</small>
            </button>
            <button
              type="button"
              class={styles.scoreRailToggle}
              aria-label={`Count-in ${formatCountInChoice(room.configuredCountInBeats())}. Change count-in`}
              title="Cycle count-in"
              onClick={cycleCountIn}
            >
              <span aria-hidden="true">
                <Ear />
              </span>
              <small>
                {formatCountInChoice(room.configuredCountInBeats())}
              </small>
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
          showTuningPresets={() => !isRunning()}
          recoveryActionLabel={() =>
            listening.canTakeOverInput() ? 'Use it here' : null
          }
          onRecoveryAction={() => void listening.useInputHere()}
          onBack={closeTuner}
        />
      </Show>
      <GuitarNightScoreSheet
        open={scoreOpen()}
        current={scoreReplay()?.summary ?? null}
        history={scoreHistory()}
        returnFocus={() => (doctorOpen() ? null : (scoreTrigger ?? null))}
        onClose={() => setScoreOpen(false)}
        {...(scoreReplay() === null
          ? {}
          : { onPlayAgain: () => void playScoreAgain() })}
        {...(scoreReplay() !== null && selectedAssessmentRange() !== null
          ? { onReviewPhrase: reviewFromScore }
          : {})}
      />
    </section>
  )
}
