// Melody practice session — calibration, reference and raw-capture judging share one contour.

import type { PitchObservation } from '../contracts'
import type { CompiledMelody, MelodyCompileOptions, MelodyDefinition, } from '../core/melody-contour'
import { compileMelody, DEFAULT_MELODY_COMPILE_LIMITS, } from '../core/melody-contour'
import type { MelodyJudge, MelodyJudgePolicy, MelodyJudgeSnapshot, } from '../core/melody-judge'
import { createMelodyJudge } from '../core/melody-judge'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { GlassGameHost, GlassVoiceSession } from '../host'
import type { MelodyPracticeRecordingAdapter } from './melody-microphone-lifecycle'
import { createMelodyMicrophoneRecovery, createMelodyPracticeRecordingLifecycle, } from './melody-microphone-lifecycle'
import { feedbackCopy, idleCopy } from './melody-practice-copy'
import type { MicrophoneIssue } from './mic-error'
import { microphoneIssue } from './mic-error'

export type MelodyPracticeMode =
  | 'idle'
  | 'permission'
  | 'calibrating'
  | 'reference'
  | 'singing'
  | 'complete'
  | 'paused'
  | 'error'

export interface MelodyPracticeSnapshot {
  mode: MelodyPracticeMode
  contour: CompiledMelody | null
  rootMidi: number | null
  pace: number
  transposeSemitones: number
  pitch: number | null
  referenceTimeSeconds: number
  judge: MelodyJudgeSnapshot | null
  message: string
  hint: string
  error: string | null
  microphoneIssue: MicrophoneIssue | null
  microphoneRecoveryPending: boolean
}

export interface MelodyPracticeConfiguration {
  pace?: number
  transposeSemitones?: number
}

export type { MelodyPracticeRecordingAdapter } from './melody-microphone-lifecycle'

export interface MelodyPracticeOptions {
  host: Pick<
    GlassGameHost,
    | 'createVoice'
    | 'readPreference'
    | 'writePreference'
    | 'subscribeForeground'
    | 'takeOverMicrophone'
    | 'releaseUnusedMicrophoneTakeover'
  >
  melody: MelodyDefinition
  createReference(compiled: CompiledMelody): MelodyReferencePlayer
  beforeCapture(): Promise<void>
  canPlay(): boolean
  onChange(snapshot: MelodyPracticeSnapshot): void
  onComplete?(snapshot: MelodyPracticeSnapshot): void
  onError?(message: string): void
  onReleaseVoice?(): void
  recording?: MelodyPracticeRecordingAdapter
  pace?: number
  transposeSemitones?: number
  judgePolicy?: Partial<MelodyJudgePolicy>
  allowedRange?: MelodyCompileOptions['allowedRange']
  now?: () => number
}

export interface MelodyPracticeController {
  snapshot(): MelodyPracticeSnapshot
  start(): Promise<void>
  recoverMicrophone(): Promise<boolean>
  hear(): Promise<void>
  replay(): Promise<void>
  configure(configuration: MelodyPracticeConfiguration): boolean
  refind(): void
  cancel(): void
  dispose(): void
}

const COMFORTABLE_NOTE_PREFERENCE = 'comfortable-note'
const DEFAULT_ALLOWED_RANGE = { minimumMidi: 36, maximumMidi: 84 } as const
const CONFIDENCE_FLOOR = 0.5
const MAXIMUM_SAMPLE_AGE_MS = 150
const MAXIMUM_SAMPLE_GAP_SECONDS = 0.1
const MAXIMUM_CALIBRATION_DRIFT = 0.8
const MINIMUM_CALIBRATION_SAMPLES = 12
const MINIMUM_CALIBRATION_SECONDS = 0.45

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validMidi(
  value: number,
  range: { minimumMidi: number; maximumMidi: number },
): boolean {
  return (
    finite(value) && value >= range.minimumMidi && value <= range.maximumMidi
  )
}

function copySnapshot(
  snapshot: MelodyPracticeSnapshot,
): MelodyPracticeSnapshot {
  return {
    ...snapshot,
    judge:
      snapshot.judge === null
        ? null
        : {
            ...snapshot.judge,
            coveredAnchorIds: [...snapshot.judge.coveredAnchorIds],
            completedPhraseIds: [...snapshot.judge.completedPhraseIds],
          },
  }
}

export function createMelodyPractice(
  options: MelodyPracticeOptions,
): MelodyPracticeController {
  const now = options.now ?? (() => performance.now())
  const allowedRange = options.allowedRange ?? DEFAULT_ALLOWED_RANGE
  if (
    !finite(allowedRange.minimumMidi) ||
    !finite(allowedRange.maximumMidi) ||
    allowedRange.minimumMidi >= allowedRange.maximumMidi
  )
    throw new Error('Melody practice requires a valid allowed pitch range.')

  let pace = options.pace ?? 1
  let transposeSemitones = options.transposeSemitones ?? 0
  let rootMidi: number | null = null
  let contour: CompiledMelody | null = null
  let judge: MelodyJudge | null = null
  let voice: GlassVoiceSession | null = null
  let stopObserving: (() => void) | null = null
  let reference: MelodyReferencePlayer | null = null
  let releaseHeld = false
  let disposed = false
  let foreground = true
  let generation = 0
  let completionNotified = false
  let calibrationSamples: Array<PitchObservation & { midi: number }> = []
  let lastSequence = -Infinity
  let lastCaptureSeconds = -Infinity
  let evidenceCapturedAfterMs = -Infinity
  const recording = createMelodyPracticeRecordingLifecycle(options.recording)
  const initial = idleCopy(options.melody)
  let state: MelodyPracticeSnapshot = {
    mode: 'idle',
    contour: null,
    rootMidi: null,
    pace,
    transposeSemitones,
    pitch: null,
    referenceTimeSeconds: 0,
    judge: null,
    message: initial.message,
    hint: initial.hint,
    error: null,
    microphoneIssue: null,
    microphoneRecoveryPending: false,
  }

  const compile = (
    root: number,
    nextPace = pace,
    nextTranspose = transposeSemitones,
  ) =>
    compileMelody(options.melody, {
      rootMidi: root,
      pace: nextPace,
      transposeSemitones: nextTranspose,
      allowedRange,
    })

  const tryCompile = (
    root: number,
    nextPace = pace,
    nextTranspose = transposeSemitones,
  ): CompiledMelody | null => {
    try {
      return compile(root, nextPace, nextTranspose)
    } catch {
      return null
    }
  }

  const rawStoredRoot = options.host.readPreference(COMFORTABLE_NOTE_PREFERENCE)
  if (rawStoredRoot !== null && rawStoredRoot.trim() !== '') {
    const storedRoot = Number(rawStoredRoot)
    const storedContour = validMidi(storedRoot, allowedRange)
      ? tryCompile(storedRoot)
      : null
    if (storedContour !== null) {
      rootMidi = storedRoot
      contour = storedContour
      state = { ...state, rootMidi, contour }
    } else options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, '')
  }

  const emit = (patch: Partial<MelodyPracticeSnapshot> = {}): void => {
    state = {
      ...state,
      ...patch,
      contour,
      rootMidi,
      pace,
      transposeSemitones,
    }
    options.onChange(copySnapshot(state))
  }

  const resetEvidence = (): void => {
    calibrationSamples = []
    lastSequence = -Infinity
    lastCaptureSeconds = -Infinity
    evidenceCapturedAfterMs = -Infinity
  }

  const releaseSilence = (): void => {
    if (!releaseHeld) return
    releaseHeld = false
    options.onReleaseVoice?.()
  }

  const holdSilence = (): Promise<void> => {
    releaseHeld = true
    return options.beforeCapture()
  }

  const stopReference = (): void => {
    const current = reference
    reference = null
    current?.stop()
    current?.dispose()
  }

  const stopVoice = (outcome: 'complete' | 'cancelled' = 'cancelled'): void => {
    stopObserving?.()
    stopObserving = null
    const current = voice
    voice = null
    recording.stop(outcome)
    current?.stop()
    resetEvidence()
    judge = null
  }

  const stopOwnedResources = (): void => {
    stopReference()
    stopVoice()
    releaseSilence()
  }

  const markEvidenceBoundary = (): void => {
    evidenceCapturedAfterMs = now()
    const latest = voice?.latest(evidenceCapturedAfterMs)
    if (latest === null || latest === undefined) return
    if (finite(latest.sequence))
      lastSequence = Math.max(lastSequence, latest.sequence)
    if (finite(latest.captureSeconds))
      lastCaptureSeconds = Math.max(lastCaptureSeconds, latest.captureSeconds)
  }

  const fail = (
    message: string,
    issue: MicrophoneIssue | null = null,
  ): void => {
    generation++
    stopOwnedResources()
    if (disposed) return
    emit({
      mode: 'error',
      pitch: null,
      judge: null,
      referenceTimeSeconds: 0,
      message,
      hint: 'You can try again when you are ready.',
      error: message,
      microphoneIssue: issue,
      microphoneRecoveryPending: false,
    })
    options.onError?.(message)
  }

  const finish = (): void => {
    if (judge === null || completionNotified) return
    const finalJudge = judge.snapshot()
    if (!finalJudge.complete) return
    completionNotified = true
    generation++
    stopReference()
    stopVoice('complete')
    releaseSilence()
    judge = null
    const copy = feedbackCopy(finalJudge)
    emit({
      mode: 'complete',
      pitch: null,
      judge: finalJudge,
      referenceTimeSeconds: 0,
      message: copy.message,
      hint: copy.hint,
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
    options.onComplete?.(copySnapshot(state))
  }

  const beginSinging = (run: number): void => {
    if (disposed || run !== generation || contour === null || voice === null)
      return
    markEvidenceBoundary()
    judge = createMelodyJudge(contour, options.judgePolicy)
    const session = voice
    recording.start(session)
    const judgeSnapshot = judge.snapshot()
    const copy = feedbackCopy(judgeSnapshot)
    emit({
      mode: 'singing',
      pitch: null,
      referenceTimeSeconds: contour.durationSeconds,
      judge: judgeSnapshot,
      message: copy.message,
      hint: copy.hint,
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
  }

  const playReference = async (run: number): Promise<void> => {
    if (contour === null || disposed || run !== generation) return
    stopReference()
    let player: MelodyReferencePlayer
    try {
      player = options.createReference(contour)
    } catch {
      fail(
        'The melody could not play. Tap Sing to try again when audio is available.',
      )
      return
    }
    reference = player
    emit({
      mode: 'reference',
      pitch: null,
      judge: null,
      referenceTimeSeconds: 0,
      message: 'Listen to the whole shape.',
      hint: 'Your turn begins only after the melody becomes quiet.',
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
    try {
      await player.play((timelineSeconds) => {
        if (disposed || run !== generation || reference !== player) return
        emit({
          referenceTimeSeconds: Math.max(
            0,
            Math.min(contour!.durationSeconds, timelineSeconds),
          ),
        })
      })
      if (disposed || run !== generation || reference !== player) return
      player.dispose()
      reference = null
      beginSinging(run)
    } catch {
      if (disposed || run !== generation || reference !== player) return
      reference = null
      player.dispose()
      fail(
        'The melody could not play. Tap Sing to try again when audio is available.',
      )
    }
  }

  const calibrationDirection = (candidate: number): string => {
    const offsets = options.melody.phrases.flatMap((phrase) =>
      phrase.anchors.map((anchor) => anchor.offsetSemitones),
    )
    const low = candidate + transposeSemitones + Math.min(...offsets)
    const high = candidate + transposeSemitones + Math.max(...offsets)
    if (high > allowedRange.maximumMidi)
      return 'Try an easy note a little lower.'
    if (low < allowedRange.minimumMidi)
      return 'Try an easy note a little higher.'
    return 'Try another easy note in the middle of your voice.'
  }

  const acceptCalibration = (candidate: number): void => {
    const nextContour = tryCompile(candidate)
    if (nextContour === null) {
      calibrationSamples = []
      emit({
        pitch: null,
        message: calibrationDirection(candidate),
        hint: 'Hold the new note gently and steadily. There is no need to be loud.',
      })
      return
    }
    rootMidi = candidate
    contour = nextContour
    options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, String(candidate))
    calibrationSamples = []
    void playReference(generation)
  }

  const observeCalibration = (
    observation: PitchObservation & { midi: number },
  ): void => {
    if (!validMidi(observation.midi, allowedRange)) {
      calibrationSamples = []
      return
    }
    const previous = calibrationSamples.at(-1)
    if (
      previous !== undefined &&
      (observation.captureSeconds - previous.captureSeconds >
        MAXIMUM_SAMPLE_GAP_SECONDS ||
        Math.abs(observation.midi - previous.midi) > MAXIMUM_CALIBRATION_DRIFT)
    )
      calibrationSamples = []
    calibrationSamples.push(observation)
    if (calibrationSamples.length > 30) calibrationSamples.shift()
    if (
      calibrationSamples.length < MINIMUM_CALIBRATION_SAMPLES ||
      observation.captureSeconds - calibrationSamples[0].captureSeconds <
        MINIMUM_CALIBRATION_SECONDS
    )
      return
    const values = calibrationSamples
      .map((sample) => sample.midi)
      .sort((left, right) => left - right)
    acceptCalibration(Math.round(values[Math.floor(values.length / 2)]))
  }

  const observe = (
    observation: PitchObservation,
    observedAtMs: number,
  ): void => {
    if (
      disposed ||
      !finite(observation.sequence) ||
      !finite(observation.captureSeconds) ||
      !finite(observation.capturedAtMs) ||
      observation.capturedAtMs < evidenceCapturedAfterMs ||
      observation.sequence <= lastSequence ||
      observation.captureSeconds <= lastCaptureSeconds
    )
      return
    lastSequence = observation.sequence
    lastCaptureSeconds = observation.captureSeconds
    const age = observedAtMs - observation.capturedAtMs
    const voiced =
      finite(age) &&
      age >= -5 &&
      age <= MAXIMUM_SAMPLE_AGE_MS &&
      observation.midi !== null &&
      finite(observation.midi) &&
      finite(observation.confidence) &&
      observation.confidence >= CONFIDENCE_FLOOR
    emit({ pitch: voiced ? observation.midi : null })
    if (state.mode === 'calibrating') {
      if (!voiced) {
        calibrationSamples = []
        return
      }
      observeCalibration(observation as PitchObservation & { midi: number })
      return
    }
    if (state.mode !== 'singing' || judge === null) return
    const events = judge.feed(observation, observedAtMs)
    const judgeSnapshot = judge.snapshot()
    const copy = feedbackCopy(judgeSnapshot)
    emit({ judge: judgeSnapshot, message: copy.message, hint: copy.hint })
    if (events.some((event) => event.type === 'complete')) finish()
  }

  const start = async (): Promise<void> => {
    if (
      disposed ||
      !foreground ||
      !options.canPlay() ||
      state.microphoneRecoveryPending ||
      !['idle', 'complete', 'error'].includes(state.mode)
    )
      return
    const run = ++generation
    stopOwnedResources()
    completionNotified = false
    resetEvidence()
    emit({
      mode: 'permission',
      pitch: null,
      judge: null,
      referenceTimeSeconds: 0,
      message: 'Opening the microphone…',
      hint: 'The museum will stay quiet while permission opens.',
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
    let session: GlassVoiceSession
    try {
      session = options.host.createVoice()
      voice = session
      const quiet = holdSilence()
      await session.start(quiet)
      if (disposed || run !== generation || voice !== session) {
        session.stop()
        return
      }
      markEvidenceBoundary()
      stopObserving = session.subscribe(
        (observation, observedAtMs) => {
          if (!disposed && voice === session) observe(observation, observedAtMs)
        },
        () => {
          if (disposed || voice !== session) return
          fail('Audio was interrupted. Tap Sing to try again.')
        },
      )
      if (contour === null) {
        emit({
          mode: 'calibrating',
          message: 'Hum an easy note.',
          hint: 'Hold it gently and steadily. There is no need to be loud.',
        })
        return
      }
      await playReference(run)
    } catch (cause) {
      if (disposed || run !== generation) return
      const issue = microphoneIssue(cause)
      fail(issue.message, issue)
    }
  }

  const recoverMicrophone = createMelodyMicrophoneRecovery({
    host: options.host,
    eligible: () =>
      !disposed &&
      foreground &&
      state.mode === 'error' &&
      !state.microphoneRecoveryPending &&
      state.microphoneIssue?.action === 'take-over',
    beginAttempt: () => ++generation,
    isCurrentAttempt: (run) => !disposed && run === generation && foreground,
    setPending: (pending) => emit({ microphoneRecoveryPending: pending }),
    retry: async () => {
      await start()
      return voice !== null
    },
    onTimeout: (issue) => {
      emit({
        message: issue.message,
        hint: 'Only another participating tab can hand the microphone over.',
        error: issue.message,
        microphoneIssue: issue,
      })
      options.onError?.(issue.message)
    },
  })

  const hear = async (): Promise<void> => {
    if (
      disposed ||
      !foreground ||
      !options.canPlay() ||
      contour === null ||
      !['idle', 'complete', 'error'].includes(state.mode)
    )
      return
    const returnMode: MelodyPracticeMode =
      state.mode === 'complete' ? 'complete' : 'idle'
    const run = ++generation
    stopOwnedResources()
    try {
      // Reach the browser audio factory inside the Hear gesture, before the
      // silence handoff introduces an await.
      const player = options.createReference(contour)
      reference = player
      const quiet = holdSilence()
      emit({
        mode: 'reference',
        pitch: null,
        referenceTimeSeconds: 0,
        message: 'Listen to the whole shape.',
        hint: 'The ribbon and the sound follow the same curve.',
        error: null,
        microphoneIssue: null,
        microphoneRecoveryPending: false,
      })
      await quiet
      if (disposed || run !== generation) return
      await player.play((timelineSeconds) => {
        if (disposed || run !== generation || reference !== player) return
        emit({
          referenceTimeSeconds: Math.max(
            0,
            Math.min(contour!.durationSeconds, timelineSeconds),
          ),
        })
      })
      if (disposed || run !== generation || reference !== player) return
      player.dispose()
      reference = null
      releaseSilence()
      const copy =
        returnMode === 'complete'
          ? feedbackCopy(state.judge!)
          : idleCopy(options.melody)
      emit({
        mode: returnMode,
        referenceTimeSeconds: 0,
        message: copy.message,
        hint: copy.hint,
      })
    } catch {
      if (disposed || run !== generation) return
      fail('The melody could not play. Try again when audio is available.')
    }
  }

  const cancel = (): void => {
    if (disposed) return
    generation++
    stopOwnedResources()
    completionNotified = false
    const copy = idleCopy(options.melody)
    emit({
      mode: 'idle',
      pitch: null,
      judge: null,
      referenceTimeSeconds: 0,
      message: copy.message,
      hint: copy.hint,
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
  }

  const stopForeground = (): void => {
    if (disposed || !foreground) return
    foreground = false
    generation++
    stopOwnedResources()
    completionNotified = false
    emit({
      mode: 'paused',
      pitch: null,
      judge: null,
      referenceTimeSeconds: 0,
      message: 'Practice paused.',
      hint: 'Return to the app, then tap Sing when you are ready.',
      error: null,
      microphoneIssue: null,
      microphoneRecoveryPending: false,
    })
  }

  const stopForegroundSubscription = options.host.subscribeForeground(
    (nextForeground) => {
      if (!nextForeground) {
        stopForeground()
        return
      }
      if (disposed) return
      foreground = true
      if (state.mode !== 'paused') return
      const copy = idleCopy(options.melody)
      emit({ mode: 'idle', message: copy.message, hint: copy.hint })
    },
  )

  emit()
  return {
    snapshot: () => copySnapshot(state),
    start,
    recoverMicrophone,
    hear,
    async replay() {
      if (
        disposed ||
        !foreground ||
        voice === null ||
        contour === null ||
        !['singing', 'reference'].includes(state.mode)
      )
        return
      const run = ++generation
      stopReference()
      recording.stop('cancelled')
      judge = null
      completionNotified = false
      resetEvidence()
      await playReference(run)
    },
    configure(configuration) {
      const nextPace = configuration.pace ?? pace
      const nextTranspose =
        configuration.transposeSemitones ?? transposeSemitones
      const offsets = options.melody.phrases.flatMap((phrase) =>
        phrase.anchors.map((anchor) => anchor.offsetSemitones),
      )
      const lowestPossibleRoot = Math.max(
        allowedRange.minimumMidi,
        allowedRange.minimumMidi - nextTranspose - Math.min(...offsets),
      )
      const highestPossibleRoot = Math.min(
        allowedRange.maximumMidi,
        allowedRange.maximumMidi - nextTranspose - Math.max(...offsets),
      )
      if (
        !finite(nextPace) ||
        nextPace < DEFAULT_MELODY_COMPILE_LIMITS.minimumPace ||
        nextPace > DEFAULT_MELODY_COMPILE_LIMITS.maximumPace ||
        !finite(nextTranspose) ||
        lowestPossibleRoot > highestPossibleRoot
      )
        return false
      const nextContour =
        rootMidi === null ? null : tryCompile(rootMidi, nextPace, nextTranspose)
      if (rootMidi !== null && nextContour === null) return false
      generation++
      stopOwnedResources()
      pace = nextPace
      transposeSemitones = nextTranspose
      contour = nextContour
      completionNotified = false
      const copy = idleCopy(options.melody)
      emit({
        mode: 'idle',
        pitch: null,
        judge: null,
        referenceTimeSeconds: 0,
        message: copy.message,
        hint: copy.hint,
        error: null,
        microphoneIssue: null,
        microphoneRecoveryPending: false,
      })
      return true
    },
    refind() {
      if (disposed) return
      generation++
      stopOwnedResources()
      rootMidi = null
      contour = null
      completionNotified = false
      options.host.writePreference(COMFORTABLE_NOTE_PREFERENCE, '')
      emit({
        mode: 'idle',
        pitch: null,
        judge: null,
        referenceTimeSeconds: 0,
        message: 'Choose a new comfortable note.',
        hint: 'Tap Sing, then hum any easy note gently and steadily.',
        error: null,
        microphoneIssue: null,
        microphoneRecoveryPending: false,
      })
    },
    cancel,
    dispose() {
      if (disposed) return
      disposed = true
      generation++
      stopOwnedResources()
      stopForegroundSubscription()
    },
  }
}
